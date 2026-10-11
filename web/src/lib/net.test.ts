import { describe, expect, it } from 'vitest';
import {
  applyProxy,
  defaultViaProxy,
  hostOf,
  isHttpUrl,
  isProxied,
  proxyRouteFor,
} from './net';

/**
 * 这一层测的是「地址怎么变成请求」——纯字符串判定，没有网络。
 *
 * 它值得单独测，是因为判断错一次的后果不小：把中转站误判成需要代理，
 * 用户的请求会打到本站一个根本不存在的路径上，而错误信息会说
 * 「本站没有部署代理」—— 一句对着安装运维说的话，操作员拿到只会一头雾水。
 */
describe('proxyRouteFor：哪两家必须走代理', () => {
  it('认那两家官方站', () => {
    expect(proxyRouteFor('https://api.openai.com')).toBe('/api-proxy/openai');
    expect(proxyRouteFor('https://api.anthropic.com')).toBe('/api-proxy/anthropic');
  });

  it('大小写与路径都不影响判断', () => {
    expect(proxyRouteFor('https://API.OpenAI.com/v1')).toBe('/api-proxy/openai');
    expect(proxyRouteFor('https://api.anthropic.com/v1/messages')).toBe('/api-proxy/anthropic');
  });

  it('用户实际在用的中转站一律直连', () => {
    expect(proxyRouteFor('https://api.a6api.com')).toBeNull();
    expect(proxyRouteFor('https://api.banban.plus')).toBeNull();
    expect(proxyRouteFor('https://api.deepseek.com')).toBeNull();
  });

  it('不是 http(s) 地址的（空串、少协议、随手打的字）都判为不代理', () => {
    expect(proxyRouteFor('')).toBeNull();
    expect(proxyRouteFor('api.openai.com')).toBeNull();
    expect(proxyRouteFor('随便写点什么')).toBeNull();
  });
});

describe('defaultViaProxy', () => {
  it('默认只对那两家打开', () => {
    expect(defaultViaProxy('https://api.openai.com')).toBe(true);
    expect(defaultViaProxy('https://api.anthropic.com')).toBe(true);
    expect(defaultViaProxy('https://api.a6api.com')).toBe(false);
  });
});

describe('applyProxy', () => {
  it('打开时把 origin 换成本站路径，保留原有 pathname', () => {
    expect(applyProxy('https://api.openai.com', true)).toBe('/api-proxy/openai');
    expect(applyProxy('https://api.anthropic.com/v1', true)).toBe('/api-proxy/anthropic/v1');
  });

  it('关掉时原样返回（哪怕地址就是那两家）', () => {
    expect(applyProxy('https://api.openai.com', false)).toBe('https://api.openai.com');
    expect(applyProxy('https://api.openai.com', undefined)).toBe('https://api.openai.com');
  });

  it('对不认识的站，打开也不动它 —— 代理转不了任意上游', () => {
    expect(applyProxy('https://api.a6api.com/v1', true)).toBe('https://api.a6api.com/v1');
  });

  it('末尾的斜杠会被修掉，免得拼出 `//v1`', () => {
    expect(applyProxy('https://api.openai.com/', true)).toBe('/api-proxy/openai');
  });
});

describe('isProxied / isHttpUrl / hostOf', () => {
  it('isProxied 只在这两个地址不同且落在代理前缀下时为真', () => {
    expect(isProxied('https://api.openai.com', '/api-proxy/openai/v1')).toBe(true);
    expect(isProxied('https://api.openai.com', 'https://api.openai.com/v1')).toBe(false);
  });

  it('isHttpUrl 挡住少了协议的那种填法', () => {
    expect(isHttpUrl('https://api.a6api.com')).toBe(true);
    expect(isHttpUrl('http://127.0.0.1:8787')).toBe(true);
    expect(isHttpUrl('api.a6api.com')).toBe(false);
    expect(isHttpUrl('ftp://files.example.com')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });

  it('hostOf 取主机名，读不出来时原样返回', () => {
    expect(hostOf('https://api.a6api.com/v1/chat/completions')).toBe('api.a6api.com');
    expect(hostOf('不是一个地址')).toBe('不是一个地址');
  });
});
