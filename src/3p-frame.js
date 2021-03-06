/**
 * Copyright 2015 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import {assert} from './asserts';
import {getLengthNumeral} from '../src/layout';
import {getService} from './service';
import {documentInfoFor} from './document-info';
import {getMode} from './mode';
import {preconnectFor} from './preconnect';
import {dashToCamelCase} from './string';
import {parseUrl, assertHttpsUrl} from './url';
import {viewerFor} from './viewer';


/** @type {!Object<string,number>} Number of 3p frames on the for that type. */
const count = {};


/**
 * Produces the attributes for the ad template.
 * @param {!Window} parentWindow
 * @param {!Element} element
 * @param {string=} opt_type
 * @return {!Object} Contains
 *     - type, width, height, src attributes of <amp-ad> tag. These have
 *       precedence over the data- attributes.
 *     - data-* attributes of the <amp-ad> tag with the "data-" removed.
 *     - A _context object for internal use.
 */
function getFrameAttributes(parentWindow, element, opt_type) {
  const width = element.getAttribute('width');
  const height = element.getAttribute('height');
  const type = opt_type || element.getAttribute('type');
  assert(type, 'Attribute type required for <amp-ad>: %s', element);
  const attributes = {};
  // Do these first, as the other attributes have precedence.
  addDataAndJsonAttributes_(element, attributes);
  attributes.width = getLengthNumeral(width);
  attributes.height = getLengthNumeral(height);
  const box = element.getLayoutBox();
  attributes.initialWindowWidth = box.width;
  attributes.initialWindowHeight = box.height;
  attributes.type = type;
  const docInfo = documentInfoFor(parentWindow);
  const viewer = viewerFor(parentWindow);
  let locationHref = parentWindow.location.href;
  // This is really only needed for tests, but whatever. Children
  // see us as the logical origin, so telling them we are about:srcdoc
  // will fail ancestor checks.
  if (locationHref == 'about:srcdoc') {
    locationHref = parentWindow.parent.location.href;
  }
  attributes._context = {
    referrer: viewer.getReferrerUrl(),
    canonicalUrl: docInfo.canonicalUrl,
    pageViewId: docInfo.pageViewId,
    clientId: element.getAttribute('ampcid'),
    location: {
      href: locationHref
    },
    tagName: element.tagName,
    mode: getMode()
  };
  const adSrc = element.getAttribute('src');
  if (adSrc) {
    attributes.src = adSrc;
  }
  return attributes;
}

/**
 * Creates the iframe for the embed. Applies correct size and passes the embed
 * attributes to the frame via JSON inside the fragment.
 * @param {!Window} parentWindow
 * @param {!Element} element
 * @param {string=} opt_type
 * @return {!Element} The iframe.
 */
export function getIframe(parentWindow, element, opt_type) {
  const attributes = getFrameAttributes(parentWindow, element, opt_type);
  const iframe = document.createElement('iframe');
  if (!count[attributes.type]) {
    count[attributes.type] = 0;
  }
  iframe.name = 'frame_' + attributes.type + '_' + count[attributes.type]++;

  // Pass ad attributes to iframe via the fragment.
  const src = getBootstrapBaseUrl(parentWindow) + '#' +
      JSON.stringify(attributes);

  iframe.src = src;
  iframe.ampLocation = parseUrl(src);
  iframe.width = attributes.width;
  iframe.height = attributes.height;
  iframe.style.border = 'none';
  iframe.setAttribute('scrolling', 'no');
  iframe.onload = function() {
    // Chrome does not reflect the iframe readystate.
    this.readyState = 'complete';
  };
  return iframe;
}

/**
 * Copies data- attributes from the element into the attributes object.
 * Removes the data- from the name and capitalizes after -. If there
 * is an attribute called json, parses the JSON and adds it to the
 * attributes.
 * @param {!Element} element
 * @param {!Object} attributes The destination.
 * visibleForTesting
 */
export function addDataAndJsonAttributes_(element, attributes) {
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name.indexOf('data-') != 0) {
      continue;
    }
    attributes[dashToCamelCase(attr.name.substr(5))] = attr.value;
  }
  const json = element.getAttribute('json');
  if (json) {
    let obj;
    try {
      obj = JSON.parse(json);
    } catch (e) {
      assert(false, 'Error parsing JSON in json attribute in element %s',
          element);
    }
    for (const key in obj) {
      attributes[key] = obj[key];
    }
  }
}

/**
 * Prefetches URLs related to the bootstrap iframe.
 * @param {!Window} parentWindow
 * @return {string}
 */
export function prefetchBootstrap(window) {
  const url = getBootstrapBaseUrl(window);
  const preconnect = preconnectFor(window);
  preconnect.prefetch(url);
  // While the URL may point to a custom domain, this URL will always be
  // fetched by it.
  preconnect.prefetch(
      'https://3p.ampproject.net/$internalRuntimeVersion$/f.js');
}

/**
 * Returns the base URL for 3p bootstrap iframes.
 * @param {!Window} parentWindow
 * @param {boolean=} opt_strictForUnitTest
 * @return {string}
 * @visibleForTesting
 */
export function getBootstrapBaseUrl(parentWindow, opt_strictForUnitTest) {
  return getService(window, 'bootstrapBaseUrl', () => {
    return getCustomBootstrapBaseUrl(parentWindow, opt_strictForUnitTest) ||
      getDefaultBootstrapBaseUrl(parentWindow);
  });
}

/**
 * Returns the default base URL for 3p bootstrap iframes.
 * @param {!Window} parentWindow
 * @return {string}
 */
function getDefaultBootstrapBaseUrl(parentWindow) {
  let url =
      'https://3p.ampproject.net/$internalRuntimeVersion$/frame.html';
  if (getMode().localDev) {
    url = 'http://ads.localhost:' + parentWindow.location.port +
        '/dist.3p/current' +
        (getMode().minified ? '-min/frame' : '/frame.max') +
        '.html';
  }
  return url;
}

/**
 * Returns the custom base URL for 3p bootstrap iframes if it exists.
 * Otherwise null.
 * @param {!Window} parentWindow
 * @param {boolean=} opt_strictForUnitTest
 * @return {?string}
 */
function getCustomBootstrapBaseUrl(parentWindow, opt_strictForUnitTest) {
  const meta = parentWindow.document
      .querySelector('meta[name="amp-3p-iframe-src"]');
  if (!meta) {
    return null;
  }
  const url = assertHttpsUrl(meta.getAttribute('content'), meta);
  assert(url.indexOf('?') == -1,
      '3p iframe url must not include query string %s in element %s.',
      url, meta);
  // This is not a security primitive, we just don't want this to happen in
  // practice. People could still redirect to the same origin, but they cannot
  // redirect to the proxy origin which is the important one.
  const parsed = parseUrl(url);
  assert((parsed.hostname == 'localhost' && !opt_strictForUnitTest) ||
      parsed.origin != parseUrl(parentWindow.location.href).origin,
      '3p iframe url must not be on the same origin as the current document ' +
      '%s (%s) in element %s. See https://github.com/ampproject/amphtml/blob/' +
      'master/spec/amp-iframe-origin-policy.md for details.', url,
      parseUrl(url).origin, meta);
  return url + '?$internalRuntimeVersion$';
}
