/* Gully Scorer – commentary phrase bank.
   Each line = [style opener] + [event core] + [style tail]. Openers/tails depend on the commentator style and the event "mood",
   cores depend on the event. 5 cores × 6 openers × 6 tails = 180 unique lines per style, per language, per event.
   Placeholders: {bt} batter · {bw} bowler · {f} fielder · {out} batter out · {zone} shot zone · {r} runs · {n} number · {b} balls
                 {team} {opp} teams · {score} score · {o} over number · {p} player · {dec} bat/bowl */
'use strict';
const CommData = (() => {
  const L = s => s.split('|').map(x => x.trim());
  // key: [mood, label, group, english cores, hindi cores]
  const C = {
    dot: ['calm', 'Dot ball', 'Runs', 'Dot ball, {bt} defends it back to {bw}.|{bw} beats the bat! No run.|Solid block from {bt}, nothing doing.|Swing and a miss from {bt}.|Straight to the fielder, no run.',
      'डॉट बॉल, {bt} ने गेंद वापस {bw} की ओर रोक दी।|{bw} ने बल्ला छका दिया! कोई रन नहीं।|{bt} का मज़बूत डिफ़ेंस, रन नहीं बना।|{bt} ने बल्ला घुमाया, पर गेंद से मुलाक़ात नहीं हुई।|सीधा फ़ील्डर के हाथ में, कोई रन नहीं।'],
    r1: ['run', '1 run', 'Runs', '{bt} nudges it to {zone} for a single.|Quick single, {bt} keeps the strike rotating.|Pushed to {zone}, they cross for one.|Just a single, tidy from {bw}.|Dabbed into the gap at {zone}, one run.',
      '{bt} ने {zone} की तरफ़ धकेलकर एक रन लिया।|तेज़ सिंगल, {bt} ने स्ट्राइक बदल दी।|{zone} की ओर खेला, एक रन पूरा।|बस एक रन, {bw} ने अच्छी गेंद डाली।|{zone} के गैप में डाला और एक रन चुरा लिया।'],
    r2: ['run', '2 runs', 'Runs', '{bt} places it to {zone} and they come back for two.|Good running, two more for {bt}.|Into the gap at {zone}, a well-run couple.|Two runs, the fielder had to chase that.|Pushed hard and they hustle back for the second.',
      '{bt} ने {zone} में खेला और दो रन दौड़ लिए।|बढ़िया रनिंग, {bt} के खाते में दो रन।|{zone} के गैप में, दो रन आसानी से।|दो रन, फ़ील्डर को दौड़ना पड़ा।|ज़ोर से धकेला और दूसरा रन भी पूरा।'],
    r3: ['run', '3 runs', 'Runs', 'Three runs! {bt} drives deep to {zone}.|Superb running, they take three.|That stopped just short of the rope, three taken.|Hard running between the wickets, three for {bt}.|Long chase towards {zone}, three runs.',
      'तीन रन! {bt} ने {zone} की ओर गहराई में खेला।|शानदार रनिंग, तीन रन पूरे।|बाउंड्री से ठीक पहले रुकी, तीन रन।|विकेटों के बीच ज़बरदस्त दौड़, {bt} को तीन रन।|{zone} की ओर लंबा पीछा, तीन रन मिले।'],
    r4: ['big', 'Four', 'Runs', 'FOUR! {bt} drives it through {zone}.|FOUR! Raced away past {zone}.|Cracking shot from {bt}, that is four.|FOUR! {bw} pays for the loose ball.|Timed to perfection, four runs through {zone}.',
      'चौका! {bt} ने {zone} से गेंद सीमा पार भेज दी।|चौका! गेंद {zone} की ओर तेज़ी से निकल गई।|{bt} का करारा शॉट, चार रन।|चौका! {bw} को ढीली गेंद महँगी पड़ी।|बेहतरीन टाइमिंग, {zone} से चार रन।'],
    r5: ['run', '5 runs', 'Runs', 'Five runs! Overthrows join the party.|Chaos in the field, five runs added.|A misfield and an overthrow, five to {bt}.|A gift of five runs for {bt}.|Five! The fielders will want that one back.',
      'पाँच रन! ओवरथ्रो ने काम आसान कर दिया।|फ़ील्डिंग में गड़बड़, पाँच रन जुड़े।|मिसफ़ील्ड और ओवरथ्रो, {bt} को पाँच रन।|{bt} को पाँच रन का तोहफ़ा।|पाँच! फ़ील्डर इसे भूलना चाहेंगे।'],
    r6: ['big', 'Six', 'Runs', 'SIX! {bt} launches it over {zone}!|SIX! That has gone out of the gully!|Huge hit from {bt}, six runs!|SIX! Into the neighbour\'s balcony at {zone}!|Maximum! {bw} can only watch it sail away.',
      'छक्का! {bt} ने गेंद {zone} के ऊपर से उड़ा दी!|छक्का! गेंद गली से बाहर!|{bt} का ज़ोरदार प्रहार, छह रन!|छक्का! गेंद सीधे पड़ोसी की बालकनी में!|{bw} बस देखते रह गए, गेंद हवा में उड़ती चली गई।'],
    wd: ['extra', 'Wide', 'Extras', 'Wide called, {bw} strays down the leg side.|That is a wide, too far outside off.|Wide! {bw} loses the line.|Extra run, the umpire stretches both arms.|Wide ball, {r} added to the total.',
      'वाइड! {bw} की गेंद लेग साइड से बाहर।|ऑफ़ स्टंप से बहुत बाहर, वाइड।|वाइड! {bw} की लाइन बिगड़ गई।|अंपायर ने दोनों हाथ फैलाए, अतिरिक्त रन।|वाइड गेंद, स्कोर में {r} रन जुड़े।'],
    nb: ['extra', 'No ball', 'Extras', 'No ball! {bw} has overstepped.|No ball called, free runs.|Front foot no ball from {bw}.|No ball! An extra delivery coming.|{bw} oversteps, that is a no ball.',
      'नो बॉल! {bw} का पैर लाइन से आगे।|नो बॉल, मुफ़्त का रन।|{bw} की फ़्रंट फ़ुट नो बॉल।|नो बॉल! एक और गेंद डालनी होगी।|{bw} ने लाइन पार की, नो बॉल।'],
    bye: ['extra', 'Byes', 'Extras', '{r} bye, the keeper could not gather it.|Byes! It beats bat and keeper.|Missed by everyone, {r} bye taken.|The keeper fumbles, they sneak {r}.|Bonus runs off nothing, byes.',
      '{r} बाई, विकेटकीपर गेंद नहीं पकड़ पाए।|बाई! गेंद बल्ले और कीपर दोनों से निकल गई।|किसी ने नहीं छुई, {r} बाई।|कीपर से चूक, {r} रन चुरा लिए।|बिना बल्ले के रन, बाई।'],
    lb: ['extra', 'Leg byes', 'Extras', 'Leg bye, off the pad for {r}.|Deflects off the body, {r} leg bye.|Off the thigh pad, they scamper {r}.|Leg byes, {bw} unlucky there.|Pads it away and they run {r}.',
      'लेग बाई, पैड से लगकर {r} रन।|शरीर से लगकर गई, {r} लेग बाई।|थाई पैड से लगी, {r} रन दौड़े।|लेग बाई, {bw} बदकिस्मत रहे।|पैड से खेली और {r} रन ले लिए।'],
    freehit: ['extra', 'Free hit coming', 'Extras', 'Free hit coming up! {bt} can swing freely.|Free hit next ball, the field has to stay.|It is a free hit, {bw} under pressure.|Free hit! Only a run out can get the batter now.|Free hit, the crowd is on its feet!',
      'अगली गेंद फ़्री हिट! {bt} खुलकर खेल सकते हैं।|फ़्री हिट, फ़ील्ड नहीं बदलेगी।|फ़्री हिट, {bw} पर दबाव।|फ़्री हिट! अब सिर्फ़ रन आउट ही होगा।|फ़्री हिट, दर्शक उठ खड़े हुए!'],
    bowled: ['wicket', 'Bowled', 'Wickets', 'BOWLED! {bw} knocks over the stumps of {bt}.|Timber! {bt} is bowled.|Clean bowled, {bt} played all around it.|Stumps everywhere! {bw} strikes.|Through the gate, {bt} has to walk.',
      'बोल्ड! {bw} ने {bt} की गिल्लियाँ उड़ा दीं।|बोल्ड! {bt} के स्टंप्स बिखर गए।|क्लीन बोल्ड, {bt} गेंद समझ ही नहीं पाए।|स्टंप्स बिखर गए! {bw} को विकेट।|बल्ले और पैड के बीच से, {bt} आउट।'],
    caught: ['wicket', 'Caught', 'Wickets', 'OUT! Caught by {f}, {bt} departs.|Taken! {f} holds on, {bw} strikes.|Up in the air and {f} takes it.|Straight down the throat of {f}, {bt} is gone.|Safe hands from {f}, big wicket for {bw}.',
      'आउट! {f} ने कैच लपका, {bt} पवेलियन लौटे।|कैच! {f} ने गेंद थाम ली, {bw} को विकेट।|गेंद हवा में और {f} ने पकड़ ली।|सीधा {f} के हाथों में, {bt} आउट।|{f} के सुरक्षित हाथ, {bw} को बड़ा विकेट।'],
    cnb: ['wicket', 'Caught & bowled', 'Wickets', 'Caught and bowled! {bw} takes the return catch.|C and B! {bw} grabs it off their own bowling.|Back to the bowler, {bw} makes no mistake.|Return catch, {bt} hits it straight to {bw}.|{bw} does it all alone, caught and bowled.',
      'कॉट एंड बोल्ड! {bw} ने ख़ुद ही कैच पकड़ा।|{bw} की अपनी गेंद पर कैच!|गेंद वापस गेंदबाज़ की ओर, {bw} ने कोई ग़लती नहीं की।|रिटर्न कैच, {bt} ने सीधा {bw} को थमा दिया।|{bw} ने अकेले ही काम तमाम कर दिया।'],
    lbw: ['wicket', 'LBW', 'Wickets', 'LBW! {bt} trapped in front by {bw}.|Plumb! {bt} is leg before.|Up goes the finger, LBW.|Hits the pad in line, {bt} must go.|Big appeal and given, LBW to {bw}.',
      'एलबीडब्ल्यू! {bw} ने {bt} को पगबाधा आउट किया।|बिल्कुल सामने, {bt} एलबीडब्ल्यू।|अंपायर की उंगली उठी, एलबीडब्ल्यू।|लाइन में पैड पर लगी, {bt} को जाना होगा।|ज़ोरदार अपील और आउट, {bw} को विकेट।'],
    runout: ['wicket', 'Run out', 'Wickets', 'RUN OUT! {out} is short of the crease.|Direct hit from {f}, {out} is gone!|Mix-up in the middle, {out} run out.|Brilliant work by {f}, {out} has to walk.|Too risky, {out} is run out.',
      'रन आउट! {out} क्रीज़ से पहले रह गए।|{f} का सीधा थ्रो, {out} आउट!|बीच में गड़बड़, {out} रन आउट।|{f} की शानदार फ़ील्डिंग, {out} पवेलियन लौटे।|बहुत जोखिम भरा रन, {out} रन आउट।'],
    stumped: ['wicket', 'Stumped', 'Wickets', 'STUMPED! {f} whips the bails off.|{bt} is out of the crease and stumped.|Lightning glovework from {f}, stumped!|{bt} charged and missed, stumped.|Stumped! {bw} deceives {bt} in the air.',
      'स्टंप! {f} ने पलक झपकते गिल्लियाँ उड़ा दीं।|{bt} क्रीज़ से बाहर और स्टंप आउट।|{f} की बिजली जैसी विकेटकीपिंग, स्टंप!|{bt} आगे बढ़े और चूक गए, स्टंप।|स्टंप! {bw} ने हवा में {bt} को छका दिया।'],
    hitwicket: ['wicket', 'Hit wicket', 'Wickets', 'Hit wicket! {bt} disturbs the stumps.|Oh no, {bt} treads on the stumps.|Bizarre dismissal, hit wicket.|{bt} knocks the bails off with the bat.|Hit wicket, unlucky for {bt}.',
      'हिट विकेट! {bt} ने ख़ुद ही स्टंप्स गिरा दिए।|अरे नहीं, {bt} का पैर स्टंप पर।|अजीब तरह से आउट, हिट विकेट।|{bt} के बल्ले से गिल्लियाँ गिरीं।|हिट विकेट, {bt} बदकिस्मत रहे।'],
    onetip: ['wicket', 'One tip one hand', 'Wickets', 'One tip one hand! {f} takes it off the wall.|Gully rules! One bounce, one hand, {bt} is out.|Off the wall into one hand of {f}, out!|{bt} cannot believe it, one tip one hand.|Classic gully catch, one tip one hand.',
      'वन टिप वन हैंड! {f} ने दीवार से टकराई गेंद पकड़ी।|गली का नियम! एक टप्पा, एक हाथ, {bt} आउट।|दीवार से लगकर {f} के एक हाथ में, आउट!|{bt} को यक़ीन नहीं, वन टिप वन हैंड।|असली गली क्रिकेट वाला कैच, वन टिप वन हैंड।'],
    hitoutside: ['wicket', 'Hit outside', 'Wickets', 'Out! {bt} hits it outside, gully rules.|Over the wall means out, {bt} has to go.|That has gone into the street, and that is out.|Too much power, {bt} is out for hitting outside.|Ball out of the ground, batter out of the game.',
      'आउट! {bt} ने गेंद बाहर मारी, गली का नियम।|दीवार के पार मतलब आउट, {bt} को जाना होगा।|गेंद सड़क पर, और {bt} आउट।|ज़्यादा ताक़त, बाहर मारने पर {bt} आउट।|गेंद मैदान के बाहर, बल्लेबाज़ खेल के बाहर।'],
    fifty: ['big', 'Fifty', 'Milestones', 'FIFTY for {bt}! {n} off {b} balls.|Half century! Take a bow, {bt}.|{bt} raises the bat, fifty up.|What a knock, {bt} reaches fifty.|Fifty! {bt} has carried this innings.',
      '{bt} का अर्धशतक! {b} गेंदों में {n} रन।|पचास पूरे! शाबाश {bt}।|{bt} ने बल्ला उठाया, अर्धशतक पूरा।|क्या पारी है, {bt} के पचास रन पूरे।|अर्धशतक! {bt} ने पारी संभाल रखी है।'],
    hundred: ['big', 'Hundred', 'Milestones', 'HUNDRED! {bt} brings up a gully century!|Century for {bt}, {n} off {b}!|A hundred in the gully, this is legendary.|{bt} reaches three figures!|Hundred! Someone get {bt} a garland.',
      'शतक! {bt} का गली क्रिकेट में शतक!|{bt} का शतक, {b} गेंदों में {n} रन!|गली में सौ रन, ये तो इतिहास है।|{bt} ने तीन अंकों का आँकड़ा छुआ!|शतक! कोई {bt} को माला पहनाओ।'],
    pship: ['big', 'Partnership', 'Milestones', '{n}-run partnership up!|{n} runs together, this pair is building something.|The partnership reaches {n}.|{n} up for this stand, the bowlers need ideas.|Solid stand, {n} runs and counting.',
      '{n} रन की साझेदारी पूरी!|दोनों ने मिलकर {n} रन जोड़े।|साझेदारी {n} रन तक पहुँची।|इस जोड़ी के {n} रन, गेंदबाज़ परेशान।|मज़बूत साझेदारी, {n} रन और जारी है।'],
    teamN: ['run', 'Team 50/100…', 'Milestones', '{n} up for {team}.|{team} bring up {n}.|That is {n} on the board for {team}.|{team} cross {n}.|{n} for {team}, steady progress.',
      '{team} के {n} रन पूरे।|{team} ने {n} का आँकड़ा छुआ।|स्कोरबोर्ड पर {team} के {n} रन।|{team} ने {n} पार किए।|{team} के {n}, अच्छी प्रगति।'],
    hattrick: ['big', 'Hat-trick', 'Milestones', 'HAT-TRICK! {bw} has three in three!|Three in a row, hat-trick for {bw}!|History in the gully, a hat-trick!|{bw} is unplayable, hat-trick!|Hat-trick! {bw} is mobbed by teammates.',
      'हैट्रिक! {bw} ने लगातार तीन विकेट लिए!|लगातार तीन, {bw} की हैट्रिक!|गली में इतिहास, हैट्रिक!|{bw} को खेलना नामुमकिन, हैट्रिक!|हैट्रिक! साथी खिलाड़ियों ने {bw} को घेर लिया।'],
    haul: ['big', '3 / 5 wickets', 'Milestones', 'That is {n} wickets for {bw}!|{bw} has {n} now, what a spell.|{n} scalps for {bw}.|{bw} is on fire, {n} wickets.|Another one, {n} for {bw}.',
      '{bw} के {n} विकेट!|{bw} के अब {n} विकेट, क्या स्पेल है।|{bw} के नाम {n} शिकार।|{bw} आग उगल रहे हैं, {n} विकेट।|एक और, {bw} के {n} विकेट।'],
    maiden: ['calm', 'Maiden over', 'Overs', 'Maiden over from {bw}!|Six balls, no runs, brilliant from {bw}.|{bw} bowls a maiden, pressure building.|Not a single run off that over.|A maiden in gully cricket, that is rare!',
      '{bw} का मेडन ओवर!|छह गेंदें, एक भी रन नहीं, शानदार {bw}।|{bw} का मेडन, दबाव बढ़ रहा है।|इस ओवर में एक भी रन नहीं।|गली क्रिकेट में मेडन, बहुत कम देखने को मिलता है!'],
    overEnd: ['calm', 'End of over', 'Overs', 'End of over {o}: {team} {score}, {r} from it.|That is over {o}, {team} are {score}.|Over {o} done, {r} runs, score {score}.|After {o} overs, {team} {score}.|{r} off the over, {team} move to {score}.',
      'ओवर {o} ख़त्म: {team} {score}, इस ओवर में {r} रन।|{o} ओवर के बाद {team} {score}।|ओवर {o} पूरा, {r} रन, स्कोर {score}।|{o} ओवर के बाद {team} का स्कोर {score}।|ओवर से {r} रन, {team} {score} पर।'],
    equation: ['calm', 'Chase equation', 'Overs', '{team} need {n} off {b} balls.|The equation: {n} from {b}.|{n} needed, {b} balls left.|It is {n} off {b} now.|{n} more to win from {b} balls.',
      '{team} को {b} गेंदों में {n} रन चाहिए।|समीकरण: {b} गेंदों में {n}।|{n} रन चाहिए, {b} गेंदें बाक़ी।|अब {b} गेंदों में {n}।|जीत के लिए {b} गेंदों पर {n} रन और।'],
    newBatter: ['calm', 'New batter', 'Match moments', '{p} walks in to bat.|New batter {p} at the crease.|{p} comes in, big job ahead.|Here comes {p}.|{p} takes guard.',
      '{p} बल्लेबाज़ी के लिए आए।|नए बल्लेबाज़ {p} क्रीज़ पर।|{p} आए, बड़ी ज़िम्मेदारी है।|अब आ रहे हैं {p}।|{p} ने गार्ड लिया।'],
    toss: ['cere', 'Toss', 'Match moments', '{team} win the toss and choose to {dec}.|The coin lands for {team}, they will {dec} first.|Toss to {team}, decision: {dec}.|{team} call it right and opt to {dec}.|Lucky {team}! They will {dec} first.',
      '{team} ने टॉस जीता और पहले {dec} चुनी।|सिक्का {team} के पक्ष में, पहले {dec}।|टॉस {team} के नाम, फ़ैसला: {dec}।|{team} ने सही कॉल किया और {dec} चुनी।|क़िस्मत {team} के साथ! पहले {dec}।'],
    inningsBreak: ['cere', 'Innings break', 'Match moments', 'Innings over: {team} {score}. {opp} need {n} to win.|{team} finish on {score}, target {n} for {opp}.|That is the innings, {opp} chase {n}.|{team} set {opp} {n} to win.|Break time! {opp} need {n}.',
      'पारी ख़त्म: {team} {score}, {opp} को जीत के लिए {n} रन चाहिए।|{team} ने {score} बनाए, {opp} के सामने {n} का लक्ष्य।|पारी समाप्त, {opp} को {n} रन बनाने हैं।|{team} ने {opp} को {n} का लक्ष्य दिया।|ब्रेक! {opp} को {n} रन चाहिए।'],
    winChase: ['cere', 'Won chasing', 'Match moments', '{team} chase it down! Won by {n} wickets.|Target achieved, {team} win by {n} wickets.|{team} cross the line with {n} wickets to spare.|Victory for {team}, {n} wickets in hand.|And that is the match! {team} win by {n} wickets.',
      '{team} ने लक्ष्य हासिल किया! {n} विकेट से जीत।|लक्ष्य पूरा, {team} {n} विकेट से जीती।|{team} ने {n} विकेट रहते मैच जीता।|{team} की जीत, {n} विकेट बाक़ी।|मैच ख़त्म! {team} ने {n} विकेट से जीता।'],
    winDefend: ['cere', 'Won defending', 'Match moments', '{team} defend it! Won by {n} runs.|{team} win by {n} runs.|Too good for {opp}, {team} win by {n} runs.|{opp} fall short by {n}, {team} celebrate.|The bowlers did it, {team} win by {n} runs.',
      '{team} ने लक्ष्य बचाया! {n} रन से जीत।|{team} {n} रन से जीती।|{opp} पर भारी पड़ी {team}, {n} रन से जीत।|{opp} {n} रन से चूक गई, {team} जश्न में।|गेंदबाज़ों ने कमाल किया, {team} {n} रन से जीती।'],
    tie: ['cere', 'Tie', 'Match moments', 'It is a tie! Scores level.|Cannot separate them, match tied!|Tied! What a finish in the gully.|Level on runs, it is a tie.|Nobody wins, nobody loses, a tie!',
      'मैच टाई! स्कोर बराबर।|कोई अलग नहीं कर सका, मैच टाई!|टाई! गली में क्या रोमांचक अंत।|रन बराबर, मैच टाई।|न कोई जीता, न कोई हारा, टाई!'],
    superOver: ['cere', 'Super Over', 'Match moments', 'Super Over time!|We need a Super Over to settle this!|One over each, here comes the Super Over.|Super Over! Nerves of steel needed.|It goes to a Super Over!',
      'सुपर ओवर का समय!|फ़ैसले के लिए सुपर ओवर!|एक-एक ओवर, सुपर ओवर आ गया।|सुपर ओवर! फ़ौलादी नसें चाहिए।|मैच सुपर ओवर में!'],
    pom: ['cere', 'Player of the Match', 'Match moments', 'Player of the Match: {p}!|Take a bow {p}, Player of the Match.|The award goes to {p}.|{p} is the Player of the Match.|Hero of the day, {p} is Player of the Match.',
      'प्लेयर ऑफ़ द मैच: {p}!|शाबाश {p}, आप हैं प्लेयर ऑफ़ द मैच।|अवॉर्ड जाता है {p} को।|{p} बने प्लेयर ऑफ़ द मैच।|आज के हीरो {p}, प्लेयर ऑफ़ द मैच।'],
  };
  const cats = {};
  Object.entries(C).forEach(([k, [mood, label, group, en, hi]]) => cats[k] = { mood, label, group, en: L(en), hi: L(hi) });

  // style → mood → lang → [openers, tails]
  const S = {
    classic: {
      label: 'Classic', desc: 'Straight, energetic TV-style calls',
      big: { en: ['What a shot!|Oh yes!|Brilliant!|Look at that!|Magnificent!', 'The crowd loves it.|Pure class.|Shot of the day, that.|Absolutely sensational.|Superb cricket.'],
        hi: ['क्या शॉट है!|वाह!|शानदार!|देखिए ज़रा!|लाजवाब!', 'दर्शक झूम उठे।|बेहतरीन क्लास।|आज का सबसे अच्छा शॉट।|बिल्कुल सनसनीखेज़।|कमाल का क्रिकेट।'] },
      run: { en: ['Good cricket.|Nicely done.|Sensible.|Smart batting.|Busy work.', 'Keeps the scoreboard ticking.|That is how you build an innings.|The fielders are kept busy.|Steady stuff.|No risks taken.'],
        hi: ['अच्छा क्रिकेट।|बढ़िया।|समझदारी भरा।|चतुर बल्लेबाज़ी।|चुस्त खेल।', 'स्कोरबोर्ड चलता रहे।|ऐसे ही पारी बनती है।|फ़ील्डर व्यस्त हैं।|स्थिर खेल।|कोई जोखिम नहीं।'] },
      calm: { en: ['And,|Well,|Right,|Okay,|Here we go,', 'Game goes on.|Nothing much in that.|Moving along.|Patience here.|Tidy enough.'],
        hi: ['और,|ख़ैर,|ठीक है,|अच्छा,|चलिए,', 'खेल जारी है।|इसमें कुछ ख़ास नहीं।|आगे बढ़ते हैं।|यहाँ धैर्य चाहिए।|ठीक-ठाक।'] },
      extra: { en: ['Oh dear,|Hmm,|Ah,|Careful,|Oops,', 'Free runs for the batting side.|Discipline needed.|Extras can hurt.|The captain will not like that.|Gifts at the wrong time.'],
        hi: ['अरे,|हम्म,|आह,|संभलकर,|उफ़,', 'बल्लेबाज़ी टीम को मुफ़्त रन।|अनुशासन चाहिए।|अतिरिक्त रन महँगे पड़ सकते हैं।|कप्तान को ये पसंद नहीं आएगा।|ग़लत समय पर तोहफ़ा।'] },
      wicket: { en: ['Gone!|Got one!|That is out!|Big moment!|Breakthrough!', 'Huge wicket.|The fielding side is jumping.|Long walk back.|That changes the game.|The bowler is pumped.'],
        hi: ['गया!|विकेट!|आउट!|बड़ा पल!|सफलता!', 'बड़ा विकेट।|फ़ील्डिंग टीम उछल पड़ी।|पवेलियन की लंबी वापसी।|इससे मैच बदल सकता है।|गेंदबाज़ जोश में।'] },
      cere: { en: ['Ladies and gentlemen,|Well then,|Big news,|Here it is,|Attention please,', 'What a day of gully cricket.|Well played, everyone.|That is what it is all about.|Memories made today.|Cricket wins.'],
        hi: ['दोस्तों,|तो फिर,|बड़ी ख़बर,|ये रहा,|ध्यान दीजिए,', 'गली क्रिकेट का क्या दिन है।|सभी ने अच्छा खेला।|यही तो असली मज़ा है।|आज यादें बनीं।|क्रिकेट की जीत हुई।'] },
    },
    paaji: {
      label: 'Paaji (funny)', desc: 'Loud, desi, one-liner comedy',
      big: { en: ['Oye hoye!|Balle balle!|Arre wah, guru!|Ohooo!|Kya baat hai, kya baat hai!', 'That ball has more air miles than my uncle!|Like a rocket on Diwali night!|The ball has applied for a passport!|Even the stray dog stood up and clapped!|Not a shot, a love letter to the boundary!'],
        hi: ['ओए होए!|बल्ले बल्ले!|अरे वाह गुरु!|ओहो!|क्या बात है, क्या बात है!', 'गेंद ने तो पासपोर्ट बनवा लिया!|दिवाली के रॉकेट की तरह उड़ी!|गली का कुत्ता भी ताली बजाने लगा!|ये शॉट नहीं, बाउंड्री को प्रेम पत्र है!|गेंद ऐसे भागी जैसे सास को देखकर दामाद!'] },
      run: { en: ['Chalo ji,|Arre bhai,|Dekho dekho,|Haan ji,|Slowly slowly,', 'Drop by drop the bucket fills, my friend!|Running like the last bus is leaving!|Singles are the dal-chawal of cricket!|The bank balance keeps growing!|Small steps, big dreams, guru!'],
        hi: ['चलो जी,|अरे भाई,|देखो देखो,|हाँ जी,|धीरे धीरे,', 'बूँद बूँद से घड़ा भरता है, गुरु!|ऐसे दौड़े जैसे आख़िरी बस छूट रही हो!|सिंगल्स तो क्रिकेट की दाल-चावल हैं!|खाता बढ़ता जा रहा है!|छोटे कदम, बड़े सपने!'] },
      calm: { en: ['Hmm,|Arre,|Oho,|Accha,|Listen,', 'Quieter than a library on a Sunday!|Patience is the mother of all boundaries!|Even the chai is getting cold!|Silence before the storm, guru!|The batter is meditating out there!'],
        hi: ['हम्म,|अरे,|ओहो,|अच्छा,|सुनो,', 'रविवार की लाइब्रेरी से भी ज़्यादा शांति!|धैर्य ही चौकों की माँ है!|चाय भी ठंडी हो रही है!|तूफ़ान से पहले की शांति, गुरु!|बल्लेबाज़ तो ध्यान लगा रहे हैं!'] },
      extra: { en: ['Arre arre,|Oye bowler ji,|Hai hai,|Uff,|Ohooo,', 'Free cheez, everybody loves it!|The bowler is distributing prasad today!|Charity begins at the crease!|Even umpire saab is shaking the head!|Line and length have gone on holiday!'],
        hi: ['अरे अरे,|ओए गेंदबाज़ जी,|हाय हाय,|उफ़,|ओहो,', 'मुफ़्त की चीज़ सबको पसंद!|गेंदबाज़ आज प्रसाद बाँट रहे हैं!|दान-पुण्य क्रीज़ से शुरू होता है!|अंपायर साहब भी सिर हिला रहे हैं!|लाइन-लेंथ छुट्टी पर चली गई!'] },
      wicket: { en: ['Oye oye oye!|Hai re!|Arre baap re!|Ohooo, gone!|Tch tch tch!', 'Cut like a kite on Sankranti!|The dream is over, pack the kit bag!|Back to the pavilion, mummy is calling!|The bowler is doing bhangra!|Gone like salary at month end!'],
        hi: ['ओए ओए ओए!|हाय रे!|अरे बाप रे!|ओहो, गया!|च च च!', 'संक्रांति पर कटी पतंग की तरह!|सपना टूट गया, किट बैग पैक करो!|पवेलियन चलो, मम्मी बुला रही हैं!|गेंदबाज़ भांगड़ा कर रहे हैं!|महीने के आख़िर में तनख़्वाह की तरह गायब!'] },
      cere: { en: ['Oye, listen everyone!|Balle balle, here it is!|Guru, guru, guru!|Drumroll please!|Arre, sun lo sab!', 'Distribute the laddoos!|This news deserves a band baaja!|Somebody call the DJ!|History written in chalk on the gully wall!|Samosa party on me!'],
        hi: ['ओए, सब सुनो!|बल्ले बल्ले, ये रहा!|गुरु गुरु गुरु!|ढोल बजाओ!|अरे, सुन लो सब!', 'लड्डू बाँटो!|इस ख़बर पर तो बैंड-बाजा होना चाहिए!|कोई डीजे बुलाओ!|गली की दीवार पर चॉक से इतिहास लिखा गया!|समोसा पार्टी मेरी तरफ़ से!'] },
    },
    silk: {
      label: 'Silk (analyst)', desc: 'Calm, elegant, insightful',
      big: { en: ['Exquisite.|Oh, that is gorgeous.|Sheer timing.|What elegance.|Beautifully played.', 'Not power, just placement and timing.|The bat came down like a pendulum.|You could frame that one.|Geometry and grace in one stroke.|The bowler missed the length by a whisker and paid.'],
        hi: ['बेहद ख़ूबसूरत।|आह, क्या शॉट है।|सिर्फ़ टाइमिंग।|कितनी नज़ाकत।|शानदार अंदाज़।', 'ताक़त नहीं, सिर्फ़ प्लेसमेंट और टाइमिंग।|बल्ला पेंडुलम की तरह आया।|इसे तो फ़्रेम करके रखना चाहिए।|एक शॉट में ज्यामिति और नज़ाकत।|गेंदबाज़ लंबाई में ज़रा चूके और क़ीमत चुकाई।'] },
      run: { en: ['Clever.|Lovely touch.|Soft hands.|Thoughtful.|Well judged.', 'Rotating the strike is an underrated art.|Good batters never let the bowler settle.|Notice the soft hands there.|Small gains add up quietly.|That is game awareness.'],
        hi: ['चतुराई।|नरम हाथ।|सधा हुआ।|सोच-समझकर।|सही अंदाज़ा।', 'स्ट्राइक बदलना एक कम आँकी गई कला है।|अच्छे बल्लेबाज़ गेंदबाज़ को जमने नहीं देते।|हाथों की नरमी देखिए।|छोटे फ़ायदे चुपचाप जुड़ते जाते हैं।|यह खेल की समझ है।'] },
      calm: { en: ['Interesting.|Now then,|Hmm.|Fair enough.|There we are.', 'The bowler has found a rhythm.|A little chess match is developing.|Pressure is a silent fielder.|Quiet balls build pressure.|Worth watching how the batter responds.'],
        hi: ['दिलचस्प।|तो अब,|हम्म।|ठीक है।|ये लीजिए।', 'गेंदबाज़ ने लय पकड़ ली है।|एक छोटा सा शतरंज का खेल चल रहा है।|दबाव एक ख़ामोश फ़ील्डर है।|शांत गेंदें दबाव बनाती हैं।|देखना होगा बल्लेबाज़ कैसे जवाब देते हैं।'] },
      extra: { en: ['Untidy.|A lapse.|Hmm.|Costly.|A wayward one.', 'Extras are runs the batting side did not have to earn.|Rhythm is lost for a moment there.|Small leaks sink big ships.|The release point slipped a fraction.|Discipline will be the theme of the next ball.'],
        hi: ['बेतरतीब।|एक चूक।|हम्म।|महँगा।|भटकी हुई गेंद।', 'अतिरिक्त रन बिना मेहनत के मिलते हैं।|लय एक पल के लिए टूट गई।|छोटे छेद बड़े जहाज़ डुबो देते हैं।|गेंद छोड़ने का बिंदु ज़रा फिसला।|अगली गेंद पर अनुशासन ज़रूरी होगा।'] },
      wicket: { en: ['And there it is.|Oh, that is the moment.|Breakthrough.|Well, well.|The plan works.', 'Set up beautifully over the last few balls.|The bowler had been building towards that.|Cricket punishes a lapse in concentration.|A wicket that shifts the momentum.|Thinking cricket from the fielding side.'],
        hi: ['और ये रहा।|आह, यही वो पल है।|सफलता।|अच्छा, अच्छा।|योजना काम आई।', 'पिछली कुछ गेंदों से इसकी तैयारी चल रही थी।|गेंदबाज़ इसी की ओर बढ़ रहे थे।|एकाग्रता की एक चूक की सज़ा मिली।|यह विकेट मैच की दिशा बदल सकता है।|फ़ील्डिंग टीम की सोच-समझकर की गई क्रिकेट।'] },
      cere: { en: ['And so,|Well,|There we have it.|Fittingly,|Rightly so,', 'Sport at its most honest.|Moments like these are why we play.|A fine advertisement for gully cricket.|The game rewards those who stay calm.|A story worth retelling.'],
        hi: ['और इस तरह,|तो,|ये रहा नतीजा।|उचित ही,|बिल्कुल सही,', 'खेल अपने सबसे सच्चे रूप में।|ऐसे ही पलों के लिए हम खेलते हैं।|गली क्रिकेट का शानदार विज्ञापन।|खेल शांत रहने वालों को इनाम देता है।|ये कहानी बार-बार सुनाई जाएगी।'] },
    },
  };
  const styles = {};
  Object.entries(S).forEach(([k, v]) => {
    styles[k] = { label: v.label, desc: v.desc, moods: {} };
    Object.keys(v).filter(m => !['label', 'desc'].includes(m)).forEach(m => {
      styles[k].moods[m] = { en: { o: L(v[m].en[0]), t: L(v[m].en[1]) }, hi: { o: L(v[m].hi[0]), t: L(v[m].hi[1]) } };
    });
  });

  const zoneHi = { 'long off': 'लॉन्ग ऑफ़', 'long on': 'लॉन्ग ऑन', cover: 'कवर', 'mid-wicket': 'मिड विकेट', point: 'पॉइंट', 'square leg': 'स्क्वेयर लेग', 'third man': 'थर्ड मैन', 'fine leg': 'फ़ाइन लेग' };
  const fallback = {
    en: { zone: ['the off side', 'the leg side', 'mid-wicket', 'cover', 'long on'], f: 'the fielder', fk: 'the keeper', dec: { bat: 'bat', bowl: 'bowl' } },
    hi: { zone: ['ऑफ़ साइड', 'लेग साइड', 'मिड विकेट', 'कवर', 'लॉन्ग ऑन'], f: 'फ़ील्डर', fk: 'विकेटकीपर', dec: { bat: 'बल्लेबाज़ी', bowl: 'गेंदबाज़ी' } },
  };
  return { cats, styles, zoneHi, fallback };
})();

