var firebaseScripts = ["https://www.gstatic.com/firebasejs/6.4.2/firebase-app.js", "https://www.gstatic.com/firebasejs/6.4.2/firebase-firestore.js"];

function appendScripts(scriptList=[]){
    scriptList.forEach(src => {
        var script = document.createElement('script');
        script.src = src;
        document.head.appendChild(script);
    });
}

async function initFirestore(){    
    appendScripts(firebaseScripts);
    /**
     * load your config bellow
     */

    var firebaseConfig = {
        
    };

    return new Promise((resolve, reject)=>{
        const loopFewTimes = () => {
            setTimeout(() => {            
                if (!firebase) {
                    console.log('not yet');
                    return loopFewTimes();
                }else{
                    // Initialize Firebase
                    resolve(firebase.initializeApp(firebaseConfig));
                }
            }, 300);
        }
        loopFewTimes();  
    });
}

//init our firebase
initFirestore()
.then(firebase=>{
    var db = firebase.firestore();
    
    /**
     * load chats
     * compare chatName and lastTimeUpdated
     * 
     * chat is new? scan the whole chat
     * chat not new? get last savepoint and start from there reading new messages
     * 
     * save the messages on database
     * update the savepoint
     * 
     */

});