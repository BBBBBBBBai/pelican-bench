/**
 * IndexedDB 在 Node 里不存在。`fake-indexeddb/auto` 往全局挂一份实现 ——
 * 记录层要测的正是「真的走一遍事务、真的升一次库版本」，拿一个手写的假对象
 * 替掉它，等于把最该测的那部分换成了我们自己写的假设。
 */
import 'fake-indexeddb/auto';
