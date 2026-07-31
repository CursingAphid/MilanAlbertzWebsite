// Token exchange for direct browser→Blob uploads (files are too big to pass
// through a serverless function). Only a logged-in admin session gets a token.
// Requires a Vercel Blob store connected to the project (BLOB_READ_WRITE_TOKEN).
import { handleUpload } from '@vercel/blob/client'
import { hasValidSession } from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!hasValidSession(req)) throw new Error('Not logged in')
        if (!/^trips\/[A-Z]{3}\/[a-z0-9-]+\//.test(pathname)) throw new Error('Invalid upload path')
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/heic',
            'image/heif',
            'video/mp4',
            'video/quicktime',
            'video/webm',
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 200 * 1024 * 1024, // 200MB per file
        }
      },
      // Called by Vercel Blob after the upload finishes; we list by prefix, so
      // no bookkeeping is needed here.
      onUploadCompleted: async () => {},
    })
    return res.status(200).json(jsonResponse)
  } catch (err) {
    return res.status(400).json({ error: String(err?.message ?? err) })
  }
}
