/*
 * Home. The site used to be one long page, so links into its sections, and
 * secret links, still arrive here; send each one to where it lives now.
 */
(function () {
  'use strict';

  const MOVED = {
    history: '/learn',
    unbreakable: '/learn#enigma',
    strength: '/learn#strength',
    today: '/learn#today',
    lab: '/lab',
    share: '/lab#share',
    desk: '/codebreaking#desk',
    daily: '/codebreaking#today',
    intercepts: '/codebreaking#missions',
  };

  const hash = location.hash;
  if (hash.startsWith('#secret=')) location.replace('/lab' + hash);
  else if (MOVED[hash.slice(1)]) location.replace(MOVED[hash.slice(1)]);
})();
