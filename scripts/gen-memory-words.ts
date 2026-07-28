// Throwaway generator: builds content/memory/{ko,en}-words.json from word lists using the real encoders.
// Run with: npx tsx scripts/gen-memory-words.ts  (tsx not installed) → instead use bun.
import { encodeKorean } from '../src/lib/memory/korean-ko.js';
import { encodeMajor } from '../src/lib/memory/major-en.js';
import { writeFileSync } from 'node:fs';

// Curated Korean child-vocabulary (8-13세). Pure Hangul.
const koWords = [
  '가방','가수','가을','강아지','개','거울','게임','고래','고양이','곰','귤','기린','기차','김치','꽃','나비','나라','나무','눈','눈사람','다리','다람쥐','달','대문','더위','도서관','돌','돼지','동굴','동물','동생','두루마리','드럼','라면','라디오','로봇','로켓','리본','마늘','마술','말','망원경','매','모래','모자','목도리','무','무지개','물고기','물소','바나나','바다','바람','바지','방','배','백조','버스','벌','벽','별','보라','보트','복숭아','부엉이','북','비','빗자루','사과','사다리','사자','산','삼','새','색연필','생선','석유','선물','성','소','소방차','소년','솔','수박','수달','수학','숟가락','숫자','스케이트','시계','신발','쌀','아귀','아기','아빠','아우','아이스','야구','야자','약','양말','양배추','여우','여자','연필','오이','오렌지','올챙이','요리','우산','우유','원숭이','유리','유원지','이','자','자동차','자전거','잠수함','장갑','재즈','저글링','전구','전차','접시','조개','주머니','주스','지구','지갑','차','참치','창문','책','책상','초','초코','축구','치약','칠판','코끼리','코알라','콩','타조','탁구','태양','토마토','통','튜브','파','파도','파티','팝콘','퍼즐','포도','포크','하마','하늘','학','해','해바라기','핫도그','호랑이','화산','회전목마'
];

// Curated English child vocabulary.
const enWords = [
  'ace','bee','book','boy','cat','cow','date','dog','doll','door','dove','dune','egg','elf','eye','face','fish','five','flag','fox','frog','game','ghost','go','goose','hat','hen','hero','home','honey','horse','ice','image','iron','jam','jar','jewel','key','kite','knee','knife','lake','lamp','leaf','leg','lime','line','lion','log','loom','love','man','map','mat','may','moon','mouse','mud','name','nest','nose','ocean','oil','owl','page','pan','pear','pen','pet','pie','pig','pill','pipe','pizza','pond','rain','rat','red','ring','road','robber','rock','roof','rose','row','rug','run','sad','sail','seal','ship','shoe','show','snake','snow','soap','sofa','star','sun','swan','tail','tall','tea','ten','tie','tire','toad','toe','tomato','toy','tree','van','vase','vine','wagon','war','whale','wheel','wind','wine','wolf','yam','yarn','yoyo','zero','zoo','boat','duck','milk','hand','girl','ball','blue','cake','fork','milk','drum','flag','gold','lamp','milk','nest','plum','rain','star','tree'
];

const uniq = <T,>(arr: T[]): T[] => Array.from(new Set(arr));
const koEntries = uniq(koWords)
  .map((w) => ({ word: w, digits: encodeKorean(w) }))
  .filter((e) => e.digits.length > 0);
const enEntries = uniq(enWords)
  .map((w) => ({ word: w, digits: encodeMajor(w) }))
  .filter((e) => e.digits.length > 0);

writeFileSync('content/memory/ko-words.json', JSON.stringify(koEntries, null, 0) + '\n');
writeFileSync('content/memory/en-words.json', JSON.stringify(enEntries, null, 0) + '\n');
console.log('ko entries:', koEntries.length, 'en entries:', enEntries.length);
console.log('sample ko:', koEntries.slice(0, 5));
console.log('sample en:', enEntries.slice(0, 5));
