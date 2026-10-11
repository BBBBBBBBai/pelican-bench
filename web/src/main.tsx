import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { requestPersistence } from './lib/idb';
import './styles.css';

/**
 * 先向浏览器要「别把这批数据当缓存清掉」这项许可，再挂界面。
 *
 * **不 await**：某些浏览器会为这个请求弹一条授权提示，等它就等于让首屏挂在
 * 一次可能需要用户点一下的对话上。它只负责让「已获准」这件事有机会成真 ——
 * 控制面板底下那一行（`config.storage.persisted`）下一次读设置就会看到结果。
 *
 * 给不给是浏览器的事：Chrome 有自己的判据（装成应用、常来、被用户授过权），
 * 被拒绝也不该挡住任何人 —— 记录照样在，只是理论上可能被当成缓存回收，
 * 「重要的记录请先导出」那句提醒说的正是这件事。
 */
void requestPersistence();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
