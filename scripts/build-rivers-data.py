#!/usr/bin/env python3
"""Build public/data/rivers.json — the river lines on the Trips globe.

Source: Natural Earth 50m "rivers + lake centerlines" (public domain),
downloaded on each run. The GeoJSON is compacted to roughly half its size:
properties are dropped except the name, MultiLineStrings are flattened into
individual paths, and coordinates are rounded to 3 decimals (~110 m).

Output format: [{"name": "...", "points": [[lat, lng], ...]}, ...]

Usage: python3 scripts/build-rivers-data.py
"""

import json
import os
import urllib.request

URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_rivers_lake_centerlines.geojson"
)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "rivers.json")


def main() -> None:
    print(f"downloading {URL}")
    with urllib.request.urlopen(URL) as res:
        data = json.load(res)

    out = []
    for feature in data["features"]:
        name = feature["properties"].get("name") or ""
        geom = feature["geometry"]
        lines = [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"]
        for line in lines:
            points = [[round(lat, 3), round(lng, 3)] for lng, lat, *_ in line]
            if len(points) >= 2:
                out.append({"name": name, "points": points})

    with open(os.path.abspath(OUT), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {os.path.abspath(OUT)} ({len(out)} paths)")


if __name__ == "__main__":
    main()
