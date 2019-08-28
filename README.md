# canarinho_nlp
labels, classify, summarization string for canarinho app


## requirements
- [install last node version](https://nodejs.org "install last node version")
- [node package manage (npm)](https://www.npmjs.com/get-npm "node package manage (npm)")

## installation
inside the folder run `npm install`

## run
`node src/classification.js`



## run some functions on chrome console
- open https://web.whatsapp.com/
- choose an group
- copy the hole code on chrome console
- call some function to see the behavior

## functions to call
 - readCurrentChat(); read all messages loaded on current open group chat
 - asyncLoadAllChatHistory(); scroll all the group messages until reach the first message 
 - scrollChatTop(); scroll one time on group messages
 - reachTop(); tells if reach the top or not
 - isAnValidChatGroup(); tells if is a group with at least 10 users
 - cancelPendingAsyncProcess(); cancel all async pending process, timeout, intervals

