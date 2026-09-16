#!/usr/bin/env python3
"""Build a deterministic, local-only bundle from an exact Git commit. Never publishes."""
import argparse, hashlib, io, json, subprocess, tarfile, tempfile, zipfile
from pathlib import Path, PurePosixPath

def git(root,*args):
    return subprocess.check_output(['git','-C',str(root),*args])

def safe(name):
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name or not p.parts:
        raise ValueError('Unsafe archive path')
    return p

def release_manifest(commit,files):
    versions={name:json.loads(files[f'plugins/{name}/.codex-plugin/plugin.json'])['version'] for name in [entry['name'] for entry in json.loads(files['.agents/plugins/marketplace.json'])['plugins']]}
    return {'schemaVersion':1,'sourceCommit':commit,'pluginVersions':versions,'dataSchemas':{'k-tech-radar':{'snapshot':2,'dictionary':2},'kgj-design':'1.0','canvas-web-experiences':None,'codex-daily-check':None},'runtimePolicy':{'nodeMaintainedMajors':[22,24],'python':'3.12+'},'verification':{'status':'not-attested-by-packager','instruction':'Attach exact-commit test receipts separately. Packaging is not runtime certification.'},'files':[{'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(files.items())]}

def check(archive, source_root, node='node'):
    dest=Path(tempfile.mkdtemp(prefix='codex-plugin-package-check-'))
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        if len(names)!=len(set(n.casefold() for n in names)): raise ValueError('Duplicate/case-colliding ZIP path')
        for member in z.infolist():
            safe(member.filename)
            if member.file_size>50_000_000: raise ValueError('Oversized archive entry')
            if ((member.external_attr>>16)&0o170000)==0o120000: raise ValueError('Archive symlink rejected')
        if sum(m.file_size for m in z.infolist())>150_000_000: raise ValueError('Oversized archive')
        manifest=json.loads(z.read('release-manifest.json'))
        if manifest.get('schemaVersion')!=1: raise ValueError('Unsupported release manifest')
        claimed=manifest.get('sourceCommit','')
        if len(claimed)!=40 or any(c not in '0123456789abcdef' for c in claimed): raise ValueError('Invalid source commit')
        resolved=git(source_root,'rev-parse','--verify',claimed+'^{commit}').decode().strip()
        if resolved!=claimed: raise ValueError('Source commit identity mismatch')
        source_files={}
        with tarfile.open(fileobj=io.BytesIO(git(source_root,'archive','--format=tar',claimed)),mode='r:') as tar:
            for member in tar:
                if member.isdir(): continue
                if not member.isfile(): raise ValueError('Non-regular source object')
                source_files[member.name]=tar.extractfile(member).read()
        expected={x['path']:x for x in manifest['files']}
        if len(expected)!=len(manifest['files']) or set(expected)!=set(source_files): raise ValueError('Manifest is not the exact source commit tree')
        if manifest!=release_manifest(claimed,source_files): raise ValueError('Manifest claims differ from source-derived release metadata')
        if set(names)!=set(expected)|{'release-manifest.json'}: raise ValueError('Archive inventory mismatch')
        for name,row in expected.items():
            data=z.read(name)
            if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']: raise ValueError('Archive hash mismatch: '+name)
            if data!=source_files[name]: raise ValueError('Archive differs from claimed source commit: '+name)
        z.extractall(dest)
    subprocess.run([node,str(source_root/'scripts/verify-public-source.mjs'),'--directory',str(dest)],check=True)
    return manifest

def build(root,commit,output,node='node'):
    if output.exists(): raise ValueError('Output exists; choose a new path')
    commit=git(root,'rev-parse','--verify',commit+'^{commit}').decode().strip()
    payload=git(root,'archive','--format=tar',commit)
    files={}
    with tarfile.open(fileobj=io.BytesIO(payload),mode='r:') as tar:
        for member in tar:
            safe(member.name)
            if member.isdir(): continue
            if not member.isfile(): raise ValueError('Only regular source files may be packaged')
            files[member.name]=tar.extractfile(member).read()
    manifest=release_manifest(commit,files)
    files['release-manifest.json']=(json.dumps(manifest,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.create_system=3;info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    check(output,root,node)
    return {'sourceCommit':commit,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'files':len(files)}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit',default='HEAD');parser.add_argument('--output',type=Path);parser.add_argument('--check',type=Path);parser.add_argument('--node',default='node');parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    args=parser.parse_args()
    if args.check: result=check(args.check,args.root,args.node);print(json.dumps({'status':'passed','sourceCommit':result['sourceCommit']}))
    elif args.output: print(json.dumps(build(args.root,args.commit,args.output,args.node)))
    else: parser.error('--output or --check required')
