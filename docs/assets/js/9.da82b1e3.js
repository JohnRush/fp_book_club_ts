(window.webpackJsonp=window.webpackJsonp||[]).push([[9],{164:function(t,e,n){"use strict";n.r(e);var s=n(0),a=Object(s.a)({},function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"content"},[t._m(0),t._v(" "),t._m(1),t._v(" "),t._m(2),t._v(" "),t._m(3),t._v(" "),t._m(4),n("div",{staticClass:"danger custom-block"},[n("p",{staticClass:"custom-block-title"},[t._v("WARNING")]),t._v(" "),n("p",[t._v("Do not use "),n("code",[t._v("Math.random")]),t._v(" in situations that call for cryptographically secure random numbers (i.e.  encryption, hashing\npasswords, generating passwords, etc.). That is not its intended use and it is not suitable for such purposes. If you\nhave a need for secure randomness, start with "),n("a",{attrs:{href:"https://nodejs.org/dist/latest-v10.x/docs/api/crypto.html#crypto_crypto",title:"Crypto | Node.js Documentation",target:"_blank",rel:"noopener noreferrer"}},[t._v("Node's "),n("code",[t._v("crypto")]),t._v(" module"),n("OutboundLink")],1),t._v(" or the "),n("a",{attrs:{href:"https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API",title:"Web Crypto API | MDN",target:"_blank",rel:"noopener noreferrer"}},[t._v("Web Crypto API"),n("OutboundLink")],1),t._v(".")])])])},[function(){var t=this.$createElement,e=this._self._c||t;return e("h1",{attrs:{id:"chapter-6-purely-functional-state"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#chapter-6-purely-functional-state","aria-hidden":"true"}},[this._v("#")]),this._v(" Chapter 6. Purely functional state")])},function(){var t=this.$createElement,e=this._self._c||t;return e("p",[this._v("We're going to investigate how to write purely functional programs that need to manipulate state, through the example of\n"),e("em",[this._v("random number generation")]),this._v(". Not particularly exciting in and of itself, but the idea is simple enough to make for a good\nintroduction.")])},function(){var t=this.$createElement,e=this._self._c||t;return e("h2",{attrs:{id:"generating-random-numbers-using-side-effects"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#generating-random-numbers-using-side-effects","aria-hidden":"true"}},[this._v("#")]),this._v(" Generating random numbers using side effects")])},function(){var t=this.$createElement,e=this._self._c||t;return e("p",[this._v("In bog-standard TypeScript/JavaScript, the universe of options available to you to generate a random number comprises\n"),e("code",[this._v("Math.random")]),this._v("... and that's it.")])},function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"language-typescript line-numbers-mode"},[n("pre",{pre:!0,attrs:{class:"language-typescript"}},[n("code",[n("span",{attrs:{class:"token operator"}},[t._v(">")]),t._v(" "),n("span",{attrs:{class:"token keyword"}},[t._v("let")]),t._v(" randomNumber "),n("span",{attrs:{class:"token operator"}},[t._v("=")]),t._v(" Math"),n("span",{attrs:{class:"token punctuation"}},[t._v(".")]),n("span",{attrs:{class:"token function"}},[t._v("random")]),n("span",{attrs:{class:"token punctuation"}},[t._v("(")]),n("span",{attrs:{class:"token punctuation"}},[t._v(")")]),n("span",{attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\nundefined\n"),n("span",{attrs:{class:"token operator"}},[t._v(">")]),t._v(" randomNumber\n"),n("span",{attrs:{class:"token number"}},[t._v("0.8158681035026218")]),t._v("\n")])]),t._v(" "),n("div",{staticClass:"line-numbers-wrapper"},[n("span",{staticClass:"line-number"},[t._v("1")]),n("br"),n("span",{staticClass:"line-number"},[t._v("2")]),n("br"),n("span",{staticClass:"line-number"},[t._v("3")]),n("br"),n("span",{staticClass:"line-number"},[t._v("4")]),n("br")])])}],!1,null,null,null);a.options.__file="chapter_6.md";e.default=a.exports}}]);