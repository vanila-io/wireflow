export const googleAnalytics = page => {
  window.ga('set', 'page', page);
  window.ga('send', 'pageview');
};
