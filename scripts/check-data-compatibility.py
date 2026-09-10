#!/usr/bin/env python3
"""Read-only schema gate for update/rollback. It never migrates or restores data."""
import argparse,json
from pathlib import Path
def compare(current,target,plugin):
    if any(m.get('schemaVersion')!=1 or plugin not in m.get('dataSchemas',{}) for m in [current,target]):
        return {'status':'blocked','reason':'Unknown release/data schema; inspect and back up the store before choosing a migration or restore'}
    if current['dataSchemas'][plugin]!=target['dataSchemas'][plugin]:
        return {'status':'blocked','reason':'Different data schemas; code rollback alone is unsafe. An explicit compatible restore or migration is required'}
    return {'status':'schema-compatible','reason':'Declared schemas match. Still run integrity and synthetic read/replay checks; no files were moved'}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('current',type=Path);p.add_argument('target',type=Path);p.add_argument('plugin');a=p.parse_args()
    result=compare(json.loads(a.current.read_text(encoding='utf-8')),json.loads(a.target.read_text(encoding='utf-8')),a.plugin)
    print(json.dumps(result));raise SystemExit(0 if result['status']=='schema-compatible' else 2)
