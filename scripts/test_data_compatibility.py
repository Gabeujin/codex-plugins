import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('compatibility',Path(__file__).with_name('check-data-compatibility.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CompatibilityTests(unittest.TestCase):
    def test_equal_and_changed_schemas(self):
        a={'schemaVersion':1,'dataSchemas':{'kgj-design':'1.0'}}
        self.assertEqual(module.compare(a,a,'kgj-design')['status'],'schema-compatible')
        self.assertEqual(module.compare(a,{'schemaVersion':1,'dataSchemas':{'kgj-design':'2.0'}},'kgj-design')['status'],'blocked')
        self.assertEqual(module.compare(a,{},'kgj-design')['status'],'blocked')
if __name__=='__main__':unittest.main()
