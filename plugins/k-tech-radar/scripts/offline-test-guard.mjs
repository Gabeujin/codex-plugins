// Test-only preload. Production MCP never imports this module.
import net from 'node:net';
const loopback=host=>['localhost','127.0.0.1','::1','[::1]'].includes(String(host).toLowerCase());
const denied=()=>{const error=new Error('External networking is disabled in public fixture tests');error.code='OFFLINE_TEST_NETWORK';throw error;};
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!loopback(url.hostname))denied();return originalFetch(input,options);};
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const first=Array.isArray(args[0])?args[0][0]:args[0];
 const host=typeof first==='object'?first.host??first.hostname:typeof args[1]==='string'?args[1]:undefined;
 if(host!==undefined&&!loopback(host))denied();
 return originalConnect.apply(this,args);
};
