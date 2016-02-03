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

import {checkData, writeScript} from '../src/3p';

/**
 * @param {!Window} global
 * @param {!Object} data
 */



export function nuggad(global, data) {
  checkData(data, ['nid', 'sid', 'sub', 'nuggrid', 'call']);
  console.log("---------- NUGGAD --------------",data)
  if (data['call'] == 'rc') {
    var src = "https://" + data['sub'] + ".nuggad.net/rc?nuggn=" + data['nid'] + "&nuggsid=" + data['sid'] + "&nuggrid=" + encodeURIComponent(data['nuggrid']);
    writeScript(global, src);
  }

  /*eslint "google-camelcase/google-camelcase": 0*/
  //global.google_page_url = global.context.canonicalUrl;
  //const s = document.createElement('script');
  //s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  //global.document.body.appendChild(s);

  //const i = document.createElement('ins');
  //i.setAttribute('data-ad-client', data['adClient']);
  //if (data['adSlot']) {
  //  i.setAttribute('data-ad-slot', data['adSlot']);
  //}
  //i.setAttribute('class', 'adsbygoogle');
  //i.style.cssText = 'display:inline-block;width:100%;height:100%;';
  //global.document.getElementById('c').appendChild(i);
}
