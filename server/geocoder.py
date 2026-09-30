#!/usr/bin/env python3
"""Private upstream key, fixed API surface, bounded upstream requests. Python 3.10+."""
import json
import math
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def upstream(path, key, **params):
    url = 'https://restapi.amap.com/v3/' + path + '?' + urlencode(dict(key=key, output='JSON', **params))
    with build_opener(NoRedirect()).open(url, timeout=4) as response:
        payload = response.read(262145)
    if len(payload) > 262144:
        raise ValueError('Response too large')
    data = json.loads(payload)
    if data.get('status') != '1':
        raise ValueError('Upstream unavailable')
    return data


def coordinates(query):
    params = parse_qs(query, keep_blank_values=True)
    if set(params) != {'lat', 'lon'} or any(len(v) != 1 for v in params.values()):
        raise ValueError('Invalid parameters')
    lat, lon = float(params['lat'][0]), float(params['lon'][0])
    if not math.isfinite(lat) or not math.isfinite(lon) or abs(lat) > 90 or abs(lon) > 180:
        raise ValueError('Invalid coordinates')
    return lat, lon


def resolve(lat, lon, key, request=upstream):
    converted = request('assistant/coordinate/convert', key, locations=f'{lon:.6f},{lat:.6f}', coordsys='gps')
    location = converted.get('locations', '')
    if not isinstance(location, str) or not re.fullmatch(r'-?\d+(\.\d+)?,-?\d+(\.\d+)?', location):
        raise ValueError('Invalid conversion')
    data = request('geocode/regeo', key, location=location, extensions='base')
    address = data['regeocode']['addressComponent']
    def field(name):
        value = address.get(name)
        return value.strip() if isinstance(value, str) else ''
    province, city, district = field('province'), field('city'), field('district')
    name = district or city
    if not name and province in ('北京市', '上海市', '天津市', '重庆市'):
        name = province
    if not name:
        raise ValueError('Missing name')
    return {'name': name, 'key': 'amap/' + (field('adcode') or '/'.join((province, city, name)))}


class Handler(BaseHTTPRequestHandler):
    slots = threading.BoundedSemaphore(4)
    def log_message(self, *args):
        pass  # URLs contain coordinates; never store access URLs or upstream errors.

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/health' and not url.query:
            return self.reply(200, {'ok': True})
        if url.path != '/v1/reverse-geocode':
            return self.reply(404, {'error': 'not_found'})
        try:
            lat, lon = coordinates(url.query)
        except (ValueError, KeyError):
            return self.reply(400, {'error': 'invalid_coordinates'})
        if not self.slots.acquire(blocking=False):
            return self.reply(429, {'error': 'busy'})
        try:
            data = resolve(lat, lon, self.server.amap_key)
        except Exception:
            return self.reply(503, {'error': 'address_unavailable'})
        finally:
            self.slots.release()
        self.reply(200, data)


if __name__ == '__main__':
    key = os.environ.get('AMAP_WEB_KEY', '').strip()
    if not re.fullmatch('[a-fA-F0-9]{32}', key):
        raise SystemExit('Configure AMAP_WEB_KEY on the server')
    server = ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8081'))), Handler)
    server.daemon_threads = True
    server.amap_key = key
    server.serve_forever()
