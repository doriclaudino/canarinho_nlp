import {
    retrieveWhatsAppsGroups,
    getGroupsBasicData,
    saveParticipantsList,
    saveWhatsAppGroups,
    saveMessages,
    retrieveWhatsMessages,
    requestWit,
    boldMessagesBeforeSend,
    sendOneMessage,
    GroupsByState,
    findCurrentUser,
    saveRobots,
    retrieveRobots,
    updateCurrentUser
} from "./lib";
import JaroWrinker from 'jaro-winkler';

async function canPerformAction(actionType = 'reader') {
    let currentUserKey = Object.keys(findCurrentUser())[0]
    if (!currentUserKey)
        throw new Error(`Can't confirm currentUser on the browser`)

    let robots = await retrieveRobots()

    if (!robots)
        throw new Error(`OH-OH there's no robots available, start with zapBot.updateCurrentUser()`)


    let userExistOnFirebase = Object.keys(robots).find(key => key === currentUserKey)
    if (!userExistOnFirebase)
        throw new Error(`OH-OH user not found on database, zapBot.updateCurrentUser()`)

    let foundUserWithType = Object.keys(robots).find(key => robots[key].type && robots[key].type === actionType)
    if (!foundUserWithType)
        throw new Error(`Theres no user with ${actionType} type`)

    let currentUserCanPerform = Object.keys(robots).find(key => key === currentUserKey && robots[key].type && robots[key].type === actionType)
    if (!currentUserCanPerform)
        throw new Error(`Current user ${currentUserKey} can't perform ${actionType} type`)
    return true
}

async function readMessages() {
    await canPerformAction('reader')
    let AllGroups = await retrieveWhatsAppsGroups() || {}
    let sourceGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'source') || []
    let ignoreGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'target') || []

    let browserData = await getGroupsBasicData(AllGroups)
    console.log({
        sourceGroupKeys
    })

    let browserGroups = browserData.groups
    let browserParticipants = browserData.participants
    let browserMessages = browserData.messages

    /**
     * not update target groups
     * set source type on source groups
     */
    console.log(browserGroups)
    let browserGroupsKeys = Object.keys(browserGroups)
    for (let index = 0; index < browserGroupsKeys.length; index++) {
        const key = browserGroupsKeys[index];
        if (browserGroups[key] && AllGroups[key] && AllGroups[key].state)
            browserGroups[key].state = AllGroups[key].state
        if (ignoreGroupKeys.includes(key))
            delete browserGroups[key]
        else if (sourceGroupKeys.includes(key))
            browserGroups[key].type = AllGroups[key].type
    }

    console.log(browserGroups)

    //delete htmlElement 
    Object.keys(browserGroups).forEach(key => {
        let copy = {
            ...browserGroups[key]
        }
        delete copy['htmlElement']
        browserGroups[key] = copy
    })

    saveParticipantsList(browserParticipants)
    saveWhatsAppGroups(browserGroups)
    saveMessages(browserMessages)
}


async function sendMessages() {
    await canPerformAction('writer')
    let AllGroups = await retrieveWhatsAppsGroups() || {}
    let targetGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'target') || []
    let ignoreGroupKeys = Object.keys(AllGroups).filter(key => AllGroups[key] && AllGroups[key].type === 'source') || []


    console.log({
        targetGroupKeys
    })

    let browserData = await getGroupsBasicData([], true)
    let browserGroups = browserData.groups

    /**
     * not update source groups
     * set target type on target groups
     */
    let browserGroupsKeys = Object.keys(browserGroups)
    for (let index = 0; index < browserGroupsKeys.length; index++) {
        const key = browserGroupsKeys[index];
        if (browserGroups[key] && AllGroups[key] && AllGroups[key].state)
            browserGroups[key].state = AllGroups[key].state
        if (ignoreGroupKeys.includes(key))
            delete browserGroups[key]
        else if (targetGroupKeys.includes(key))
            browserGroups[key].type = AllGroups[key].type
    }

    let AllMessages = await retrieveWhatsMessages()

    //filter 24h messages only
    let yesterday = new Date().getTime() / 1000 - 24 * 60 * 60
    let msgsKeys = Object.keys(AllMessages).filter(key => AllMessages[key].t > yesterday)
    //link state to messages
    for (let index = 0; index < msgsKeys.length; index++) {
        const key = msgsKeys[index];
        let msg = AllMessages[key]
        msg.state = AllGroups[msg.g].state
        AllMessages[key] = msg
    }

    let JaroWrinker_sameUser = .9
    let JaroWrinker_differentUser = .8

    let noSpamm = {}
    for (let index = 0; index < msgsKeys.length; index++) {
        const key = msgsKeys[index];
        let msg = AllMessages[key]

        //the key is founded matching another message on noSpamm collection
        if (Object.keys(noSpamm).find(tempKey => noSpamm[tempKey] && noSpamm[tempKey].jaroWrinker && noSpamm[tempKey].jaroWrinker[key])) continue;

        //add new item on collection
        if (!noSpamm[key]) {
            noSpamm[key] = msg
            noSpamm[key].jaroWrinker = {}
        }

        msg.state = AllGroups[msg.g].state
        AllMessages[key] = msg

        for (let index2 = 0; index2 < msgsKeys.length; index2++) {
            const key2 = msgsKeys[index2];
            let msg2 = AllMessages[key2]

            if (key2 === key) continue
            let jaroSimilarity = JaroWrinker(msg.text, msg2.text)

            //save jaroSimilatiry on object
            if (msg2.senderId === msg.senderId && jaroSimilarity > JaroWrinker_sameUser)
                noSpamm[key].jaroWrinker[key2] = jaroSimilarity
            if (msg2.senderId !== msg.senderId && jaroSimilarity > JaroWrinker_differentUser)
                noSpamm[key].jaroWrinker[key2] = jaroSimilarity
        }
    }
    console.log({
        noSpamm
    })

    /**
     * maybe here we check if was processed/send before and skip
     * after 24h we don't compare as spamm anymore in other words: everything equals in 24h windows is an spamm
     * 
     * if some text on noSpamm was sent we skip
     * if some text as jaroSimilarity was sent we skip
     */



    let noSpammKeys = Object.keys(noSpamm)
    let witClassificated = {}
    for (let index = 0; index < noSpammKeys.length; index++) {
        const key = noSpammKeys[index];
        let msg = noSpamm[key]

        //remove tokens
        msg.wit = await requestWit('https://api.wit.ai/message?v=20191001&q=', 'LYLIAYXEP6IRP6MOH7O7222VI4LVVAXG', msg.text)
        witClassificated[key] = msg
    }
    console.log({
        witClassificated
    })

    let boldedMessagesCollection = boldMessagesBeforeSend(witClassificated)
    console.log({
        boldedMessagesCollection
    })

    //only items with bold text
    let boldKeys = Object.keys(boldedMessagesCollection).filter(key => boldedMessagesCollection[key].boldtext)

    //target groups to send
    let targetGroups = Object.keys(browserGroups).filter(key => targetGroupKeys.includes(key)).map(key => browserGroups[key])

    //get groups by states ready
    let groupsByState = GroupsByState(targetGroups)
    for (let index = 0; index < boldKeys.length; index++) {
        const key = boldKeys[index];
        let msg = boldedMessagesCollection[key]

        //select groups based on message state
        let groupsToSend = groupsByState[msg.state]

        //sending message to each state
        //we can make a queue with, groupname, message
        await groupsToSend.forEach(async groupId => {
            let group = targetGroups[groupId]
            console.log(group)
            console.log(`abrindo grupo ${group.formattedTitle} mensage: ${msg.text}`)
            let sent = await sendOneMessage(group.htmlElement, msg.boldtext)
            console.log('sent', sent)
        });
    }

    //delete htmlElement 
    Object.keys(browserGroups).forEach(key => {
        let copy = {
            ...browserGroups[key]
        }
        delete copy['htmlElement']
        browserGroups[key] = copy
    })


    /***
     * we can mark messages with processedflag
     * and next loop always get 24h messages without flag
     */
    saveMessages(boldedMessagesCollection)

    saveWhatsAppGroups(browserGroups)
}




let zapbot = window.zapBot
window.zapBot = {
    ...zapbot,
    readMessages,
    sendMessages,
    retrieveWhatsAppsGroups,
    getGroupsBasicData,
    saveWhatsAppGroups,
    findCurrentUser,
    saveRobots,
    retrieveRobots,
    updateCurrentUser
}