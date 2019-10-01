module.exports = {
    witConfig: {
        classificationInterval: 1.5,
        token: '',
        baseUrl: 'https://api.wit.ai/message?v=20191001&q='
    },
    spammConfig: {
        JaroWrinker: {
            sameUser: 0.8,
            differentUser: 0.9
        }
    },
    localStorageKey: 'zap_bot_key',
    htmlElements: {
        chatList: {
            id: 'pane-side',
            path: [0, 0]
        },
        selected_title: {
            path: [0, 0, 5, 3, 0, 1, 1, 0, 0, 0]
        },
        chat_history: {
            path: [0, 0, 5, 3, 0, 4, 0]
        },
    }
}