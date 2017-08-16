// vers 1.0.0b

const format = require('./format.js');

const BossId = [470, 1000]; // Manglemire

//ActionId: truth, lie
const BossActions = {
    1171655820: {truth: 'Truth -> Break shield',     lie: 'Lie -> Puddles (run away)'},   // "My shield will save me!" (shield)
    1171655821: {truth: 'Truth -> Stay outside',     lie: 'Lie -> Stay inside'},          // "I will kill you all!" (aoe around boss)
    1171655826: {truth: 'Truth -> Stay outside',     lie: 'Lie -> Stay inside'}           // "One of you must die!" (aoe around player)
};

//AbnormalId: BossBuff
const BossAbnormals = {
    470046: 3,
    470047: 6,
    470048: 9
};

module.exports = function MMGuide(dispatch) {
	
	let enabled = true,
		sendToParty = false,
		boss = undefined,
        bossBuffs = [],
        meterValue = 0;
		
	const chatHook = event => {		
		let command = format.stripTags(event.message).split(' ');
		
		if (['!mm'].includes(command[0].toLowerCase())) {
			toggleModule();
			return false;
		} else if (['!mm.party'].includes(command[0].toLowerCase())) {
			toggleSentMessages();
			return false;
		}
	}
	dispatch.hook('C_CHAT', 1, chatHook)	
	dispatch.hook('C_WHISPER', 1, chatHook)
  	
	// slash support
	try {
		const Slash = require('slash')
		const slash = new Slash(dispatch)
		slash.on('mmn', args => toggleModule())
		slash.on('mm.party', args => toggleSentMessages())
	} catch (e) {
		// do nothing because slash is optional
	}
			
	function toggleModule() {
		enabled = !enabled;
		systemMessage((enabled ? 'enabled' : 'disabled'));
	}

	function toggleSentMessages() {
		sendToParty = !sendToParty;
		systemMessage((sendToParty ? 'Messages will be sent to the party' : 'Only you will see messages'));
	}	
	
    function bossHealth() {
        return (boss.curHp / boss.maxHp);
    }
    
	function isTellingTruth() {
        let ones = meterValue % 10;
        let tens = Math.floor((meterValue % 100) / 10);

        if (bossBuffs.includes(ones) || bossBuffs.includes(tens))
        {
            return false;
        }         
        return true;
	 }

	dispatch.hook('S_ABNORMALITY_BEGIN', 1, (event) => {
		if (!enabled || !boss) return;
                
        if (boss.id - event.target == 0) {
			//console.log('\n S_ABNORMALITY_BEGIN  -> ' + event.id);
            
            if (BossAbnormals[event.id]) {
                if (!bossBuffs.includes(BossAbnormals[event.id])) bossBuffs.push(BossAbnormals[event.id]);
            }
		}
    })

	dispatch.hook('S_ABNORMALITY_END', 1, (event) => {
		if (!enabled || !boss) return;
                
        if (boss.id - event.target == 0) {
			//console.log('\n S_ABNORMALITY_END  -> ' + event.id);
            
            let index = bossBuffs.indexOf(BossAbnormals[event.id]);
			if (index > -1) bossBuffs.splice(index, 1);            
		}
    })

	// dispatch.hook('S_ABNORMALITY_REFRESH', 1, (event) => {
		// if (!enabled || !boss) return;
                
        // if (boss.id - event.target == 0) {
			// console.log('\n S_ABNORMALITY_REFRESH  -> ' + event.id);
		// }
    // })    
    
	dispatch.hook('S_DUNGEON_EVENT_GAGE', 1, (event) => {
		if (!enabled || !boss) return;
                
        meterValue = event.value;
    })
	
	dispatch.hook('S_BOSS_GAGE_INFO', 2, (event) => {
		if (!enabled) return;
		
		if (event.huntingZoneId == BossId[0] && event.templateId == BossId[1]) {
			boss = event;
		}
		
		if (boss) {
			let bossHp = bossHealth();
			
			if (bossHp == 0) boss = undefined;
			if (bossHp == 0 || bossHp == 1) {
                bossBuffs = [];
                meterValue = 0;
			}
			
		}
	 })
	
	dispatch.hook('S_ACTION_STAGE', 1, (event) => {
		if (!enabled || !boss) return;
		
		if (boss.id - event.source == 0) {
			 if (BossActions[event.skill]) {
                sendMessage(isTellingTruth() ? BossActions[event.skill].truth : BossActions[event.skill].lie)		
			}
		}
	})

	function sendMessage(msg) {
		if (!enabled) return;
		
		console.log(msg);
		
		if (sendToParty) {
			dispatch.toServer('C_CHAT', 1, {
				channel: 1, //21 = p-notice, 1 = party
				message: msg
			});
		} else {
			dispatch.toClient('S_CHAT', 1, {
				channel: 21, //21 = p-notice, 1 = party
				authorName: 'DG-Guide',
				message: msg
			});
		}		
	}	
		
	function systemMessage(msg) {
		dispatch.toClient('S_CHAT', 1, {
			channel: 24, //system channel
			authorName: '',
			message: ' (MM-Guide) ' + msg
		});
	}

}