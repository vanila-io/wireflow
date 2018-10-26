import { BrowserPolicy } from 'meteor/browser-policy-common';
import { Meteor } from 'meteor/meteor';

Meteor.startup(() => {
  BrowserPolicy.content.allowInlineStyles();
  BrowserPolicy.content.allowOriginForAll('maxcdn.bootstrapcdn.com');
  BrowserPolicy.content.allowOriginForAll('moonly-test.s3.amazonaws.com');
  BrowserPolicy.content.allowOriginForAll('fonts.gstatic.com');
  BrowserPolicy.content.allowOriginForAll('fonts.googleapis.com');

  BrowserPolicy.content.allowOriginForAll('cdn.mouseflow.com');
  BrowserPolicy.content.allowOriginForAll('ajax.googleapis.com');
  BrowserPolicy.content.allowOriginForAll('o2.mouseflow.com');

  BrowserPolicy.content.allowOriginForAll('google-analytics.com');
  BrowserPolicy.content.allowOriginForAll('www.google-analytics.com');
  BrowserPolicy.content.allowOriginForAll('placeholdit.imgix.net');
  BrowserPolicy.content.allowConnectOrigin('blob:');
  BrowserPolicy.content.allowEval();
  BrowserPolicy.content.allowImageOrigin('blob:');
  const constructedCsp = BrowserPolicy.content._constructCsp();
  BrowserPolicy.content.setPolicy(constructedCsp + ' media-src blob:;');
});
