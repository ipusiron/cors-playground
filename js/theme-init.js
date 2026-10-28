/**
 * theme-init - 最初の描画の前にテーマを決める。<head> で同期読み込みする。
 *
 * css/style.css の既定はライトで、ダークは <html> の dark クラス（:root.dark）で切り替える。
 * この判定を </body> 直前の js/app.js で行うと、ライトで描いたあとにダークへ
 * 切り替わって見える（ダークを保存した人だけに起きる）。
 *
 * 保存した選択（localStorage の corspg-theme が 'dark'）ならダーク、それ以外はライト。
 * システムの prefers-color-scheme は使わない（app.js の設計方針と同じ）。
 * localStorage が拒否される環境でも落ちないよう try/catch で囲む。
 */
(function initThemeBeforePaint(global){
  'use strict';
  let stored = null;
  try { stored = global.localStorage.getItem('corspg-theme'); } catch (error) { stored = null; }
  if(stored === 'dark') global.document.documentElement.classList.add('dark');
})(typeof window !== 'undefined' ? window : globalThis);
