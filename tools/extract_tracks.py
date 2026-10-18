"""Extract the 1 Hz GPS fixes of the 2017 drift logs (PX4 .ulg, repo analyse-derive-suwave) into tracks/raw.json.

    uv run --with pyulog --with numpy python tools/extract_tracks.py   # paths below point to ~/scratch/suwave-src
"""
# Extract 1 Hz GPS tracks (lat, lon, t) from the PX4 ULog drift logs, concatenated per drone/day.
import glob, os, json, sys, math
from pyulog import ULog
base = os.path.expanduser('~/scratch/suwave-src/analyse-derive-suwave')
out = {}
for d in sorted(glob.glob(base + '/deriveDrone_*')):
    name = os.path.basename(d)
    pts = []
    for f in sorted(glob.glob(d + '/*.ulg')):
        if os.path.getsize(f) == 0: continue
        try:
            u = ULog(f, ['vehicle_gps_position', 'sensor_combined', 'airspeed'])
        except Exception as e:
            print('ERR', f, e); continue
        g = [x for x in u.data_list if x.name == 'vehicle_gps_position']
        s = [x for x in u.data_list if x.name == 'sensor_combined']
        if not g: continue
        g = g[0].data
        lat = g['lat'] / 1e7; lon = g['lon'] / 1e7; tu = g['time_utc_usec'] / 1e6
        fix = g['fix_type']
        az = None
        if s:
            sd = s[0].data
            key = 'accelerometer_m_s2[2]'
            if key in sd:
                import numpy as np
                az = np.interp(g['timestamp'], sd['timestamp'], sd[key])
        for i in range(len(lat)):
            if fix[i] >= 3 and tu[i] > 1e9:
                pts.append([round(tu[i], 1), round(float(lat[i]), 7), round(float(lon[i]), 7), round(float(az[i]), 2) if az is not None else None])
    pts.sort()
    out[name] = pts
    if pts: print(name, len(pts), pts[0][:3], pts[-1][:3])
json.dump(out, open(os.path.expanduser('~/scratch/suwave-src/tracks/raw.json'), 'w'))
