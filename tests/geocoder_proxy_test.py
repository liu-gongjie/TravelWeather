import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('proxy', Path(__file__).parents[1] / 'server/geocoder.py')
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)


class ProxyTests(unittest.TestCase):
    def test_invalid_input(self):
        for query in ('lat=nan&lon=0', 'lat=91&lon=0', 'lat=0&lon=inf', 'lat=0&lon=0&key=x', 'lat=0&lat=1&lon=0', 'lat=&lon=0'):
            with self.assertRaises(ValueError):
                proxy.coordinates(query)

    def test_conversion_order_and_minimal_output(self):
        calls = []
        def request(path, key, **params):
            calls.append((path, params))
            if path.startswith('assistant/'):
                return {'locations': '113.1,28.1'}
            return {'regeocode': {'addressComponent': {'district': '岳麓区', 'adcode': '430104', 'city': '长沙市', 'street': '不应返回'}}}
        result = proxy.resolve(28, 113, 'test-only', request)
        self.assertEqual(result, {'name': '岳麓区', 'key': 'amap/430104'})
        self.assertEqual(calls[0][1]['locations'], '113.000000,28.000000')
        self.assertEqual(calls[1][1]['location'], '113.1,28.1')

    def test_municipality_array(self):
        def request(path, key, **params):
            return {'locations': '116,39'} if path.startswith('assistant/') else {'regeocode': {'addressComponent': {'city': [], 'province': '北京市'}}}
        self.assertEqual(proxy.resolve(39, 116, 'test-only', request)['name'], '北京市')


if __name__ == '__main__':
    unittest.main()
