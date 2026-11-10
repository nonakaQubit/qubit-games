// 復活の呪文（単語式セーブ・ロード & 𝕏シェアモジュール）
// 32bitビットパック: バージョン(3bit) + クリア海域(4bit) + 現在海域(2bit) + 図鑑発見フラグ(18bit) + チェックサム(5bit)
// 32bit = 8bit × 4単語（形容詞 + 海・場所 + 動詞 + 主語・生き物）

export const DICT = {
  adj: [
    ['静かな', 'calm'], ['澄み渡る', 'crystal'], ['深き', 'deep'], ['遙かな', 'distant'],
    ['輝く', 'shining'], ['波立つ', 'surging'], ['蒼き', 'azure'], ['果てなき', 'endless'],
    ['光る', 'glowing'], ['悠久の', 'ancient'], ['凍てつく', 'frozen'], ['凪いだ', 'placid'],
    ['雄大な', 'grand'], ['碧き', 'emerald'], ['夜明けの', 'dawn'], ['黄昏の', 'twilight'],
    ['月照らす', 'moonlit'], ['星降る', 'starry'], ['神秘の', 'mystic'], ['冷たき', 'chilly'],
    ['穏やかな', 'gentle'], ['広大なる', 'vast'], ['静寂の', 'silent'], ['銀の', 'silver'],
    ['黄金の', 'golden'], ['真珠の', 'pearly'], ['藍色の', 'indigo'], ['群青の', 'ultramarine'],
    ['薄明の', 'dim'], ['透き通る', 'lucid'], ['温もりある', 'warm'], ['潮香る', 'briny'],
    ['泡沫の', 'foamy'], ['波間の', 'rippling'], ['微睡む', 'slumbering'], ['目覚めし', 'awakened'],
    ['風渡る', 'breezy'], ['霧深き', 'misty'], ['白き', 'white'], ['清らかな', 'pure'],
    ['幽玄の', 'subtle'], ['孤高の', 'solitary'], ['誇り高き', 'noble'], ['悠然たる', 'serene'],
    ['自由なる', 'free'], ['美しき', 'fair'], ['荒れ狂う', 'stormy'], ['険しき', 'rugged'],
    ['未知なる', 'unknown'], ['眩き', 'dazzling'], ['煌めく', 'sparkling'], ['揺らぐ', 'wavering'],
    ['底知れぬ', 'abyssal'], ['果てしなき', 'boundless'], ['仄暗き', 'shadowy'], ['朧げな', 'hazy'],
    ['陽光の', 'sunny'], ['天青の', 'cerulean'], ['紺碧の', 'sapphire'], ['瑠璃色の', 'lapis'],
    ['翠緑の', 'jade'], ['琥珀の', 'amber'], ['白銀の', 'argent'], ['漆黒の', 'ebon'],
    ['太古の', 'primeval'], ['静謐な', 'tranquil'], ['安らかな', 'peaceful'], ['清澄な', 'limpid'],
    ['冴えわたる', 'crisp'], ['波光の', 'shimmering'], ['潮騒の', 'whispering'], ['悠久なる', 'eternal'],
    ['深遠なる', 'profound'], ['天翔る', 'soaring'], ['旅ゆく', 'voyaging'], ['彷徨える', 'wandering'],
    ['憩える', 'resting'], ['立ち昇る', 'rising'], ['沈みゆく', 'sinking'], ['満ちわたる', 'brimming'],
    ['澄明な', 'pellucid'], ['透き通った', 'clear'], ['柔らかな', 'tender'], ['温かな', 'mellow'],
    ['冷涼な', 'cool'], ['厳かな', 'solemn'], ['神聖な', 'sacred'], ['青光りする', 'phosphor'],
    ['幻惑の', 'elusive'], ['移ろう', 'shifting'], ['無垢なる', 'innocent'], ['息づく', 'living'],
    ['漂泊の', 'drifting'], ['風雅な', 'graceful'], ['流麗な', 'flowing'], ['軽やかな', 'agile'],
    ['健やかな', 'hale'], ['逞しい', 'robust'], ['精悍な', 'sleek'], ['巨大なる', 'colossal'],
    ['壮大なる', 'immense'], ['宏遠な', 'lofty'], ['果て知らぬ', 'infinite'], ['広々とした', 'spacious'],
    ['広漠たる', 'boundless'], ['渺々たる', 'limitless'], ['幽遠な', 'fathomless'], ['無涯の', 'shoreless'],
    ['極光の', 'auroral'], ['氷晶の', 'glacial'], ['雪白の', 'snowy'], ['霜置く', 'frosty'],
    ['夜色の', 'nocturnal'], ['日差し差す', 'sunlit'], ['夕凪の', 'eventide'], ['朝凪の', 'morning'],
    ['東風の', 'easterly'], ['西風の', 'westerly'], ['南風の', 'southerly'], ['北風の', 'northerly'],
    ['潮気ある', 'saline'], ['海色の', 'marine'], ['洋上の', 'oceanic'], ['水際の', 'aquatic'],
    ['水深の', 'bathyal'], ['外洋の', 'pelagic'], ['沿岸の', 'coastal'], ['内湾の', 'inshore'],
    ['青緑の', 'teal'], ['灰緑の', 'sage'], ['海緑の', 'aquamarine'], ['淡青の', 'cyan'],
    ['濃紺の', 'navy'], ['墨色の', 'inky'], ['鈍色の', 'slate'], ['真珠色の', 'opal'],
    ['虹色の', 'iridescent'], ['玉虫色の', 'prismatic'], ['月光の', 'lunar'], ['星彩の', 'astral'],
    ['天海の', 'ethereal'], ['夢見の', 'dreamy'], ['幻想の', 'visionary'], ['幽けき', 'faint'],
    ['遥けき', 'yonder'], ['常しえの', 'everlasting'], ['不変の', 'immutable'], ['無窮の', 'timeless'],
    ['巡りゆく', 'circling'], ['潮引く', 'ebbing'], ['潮満つ', 'flowing'], ['渦巻く', 'eddying'],
    ['波飛沫の', 'splashing'], ['水煙の', 'spraying'], ['波泡の', 'frothing'], ['泡立つ', 'bubbling'],
    ['白波の', 'crested'], ['逆巻く', 'surging'], ['うねる', 'rolling'], ['波立つ', 'undulating'],
    ['静まり返る', 'hushed'], ['凪ぎわたる', 'calmed'], ['平穏な', 'untroubled'], ['泰然たる', 'composed'],
    ['颯爽たる', 'brisk'], ['伸びやかな', 'supple'], ['滑らかな', 'smooth'], ['艶やかな', 'glossy'],
    ['純白の', 'ivory'], ['銀白の', 'silvery'], ['浅黄の', 'flaxen'], ['珊瑚の', 'coral'],
    ['真紅の', 'crimson'], ['朱鷺色の', 'rosy'], ['茜さす', 'ruddy'], ['曙の', 'aurora'],
    ['黄昏色の', 'crepuscular'], ['宵の', 'vesper'], ['深夜の', 'midnight'], ['深層の', 'abyssal'],
    ['中層の', 'mesopelagic'], ['表層の', 'epipelagic'], ['湧昇の', 'upwelling'], ['回流の', 'gyral'],
    ['海流の', 'current'], ['潮流の', 'tidal'], ['親潮の', 'oyashio'], ['黒潮の', 'kuroshio'],
    ['極圏の', 'polar'], ['亜寒帯の', 'subarctic'], ['温帯の', 'temperate'], ['熱帯の', 'tropical'],
    ['孤島の', 'insular'], ['暗礁の', 'reefy'], ['岩礁の', 'rocky'], ['砂州の', 'sandy'],
    ['氷山の', 'berg'], ['氷盤の', 'floe'], ['結氷の', 'iced'], ['融氷の', 'thawing'],
    ['深閑たる', 'solitary'], ['孤絶の', 'isolated'], ['閑雅なる', 'quiet'], ['悠々たる', 'easy'],
    ['飄々たる', 'blithe'], ['朗らかな', 'cheerful'], ['清爽な', 'bracing'], ['涼やかな', 'crisp'],
    ['晴朗な', 'radiant'], ['薄晴れの', 'fair'], ['朧ろな', 'misty'], ['霞立つ', 'vaporous'],
    ['雨模様の', 'rainy'], ['時化の', 'squally'], ['烈風の', 'stormy'], ['疾風の', 'gale'],
    ['清冽な', 'pellucid'], ['澄明なる', 'limpid'], ['純潔な', 'chaste'], ['汚れなき', 'spotless'],
    ['名もなき', 'nameless'], ['語られぬ', 'untold'], ['伝説の', 'fabled'], ['神話の', 'mythic'],
    ['古の', 'olden'], ['始原の', 'primordial'], ['無限の', 'infinite'], ['広茫たる', 'boundless'],
    ['果て無き', 'endless'], ['涯てなき', 'ceaseless'], ['悠久の', 'ageless'], ['永遠なる', 'sempiternal'],
    ['蒼茫たる', 'vast-blue'], ['青々とした', 'verdant'], ['濃青の', 'cobalt'], ['碧緑の', 'viridian'],
    ['紺青の', 'prussian'], ['浅葱色の', 'light-blue'], ['白群の', 'pale-blue'], ['水浅葱の', 'aqua'],
    ['月影の', 'moonbeam'], ['日輪の', 'solar'], ['星群の', 'stellar'], ['銀河の', 'galactic'],
    ['潮路の', 'seaway'], ['航跡の', 'wake'], ['浮標の', 'buoyed'], ['灯台の', 'beaconic'],
    ['深海の', 'deep-sea'], ['極洋の', 'polar-ocean'], ['浅海の', 'shallow'], ['内海の', 'inland-sea'],
    ['遠浅の', 'shoaling'], ['急潮の', 'rapid-tide'], ['逆潮の', 'counter-tide'], ['満潮の', 'high-tide']
  ],
  loc: [
    ['海を', 'sea'], ['深海を', 'deep-sea'], ['浅瀬を', 'shallows'], ['外洋を', 'open-sea'],
    ['極北を', 'far-north'], ['海峡を', 'strait'], ['入り江を', 'cove'], ['潮目を', 'ocean-front'],
    ['黒潮を', 'kuroshio'], ['氷海を', 'ice-sea'], ['大洋を', 'ocean'], ['波間を', 'waves'],
    ['海底を', 'seabed'], ['水面を', 'surface'], ['遠洋を', 'high-seas'], ['海原を', 'waters'],
    ['蒼穹を', 'firmament'], ['天涯を', 'horizon'], ['蒼海を', 'blue-sea'], ['碧海を', 'green-sea'],
    ['北極海を', 'arctic-sea'], ['南極海を', 'antarctic-sea'], ['オホーツクを', 'okhotsk'], ['土佐湾を', 'tosa-bay'],
    ['北大西洋を', 'north-atlantic'], ['白令海を', 'bering-sea'], ['千島列島を', 'kurils'], ['知床を', 'shiretoko'],
    ['太平洋を', 'pacific'], ['大西洋を', 'atlantic'], ['インド洋を', 'indian-ocean'], ['珊瑚海を', 'coral-sea'],
    ['極圏を', 'polar-zone'], ['亜寒帯を', 'subarctic'], ['温帯海を', 'temperate-sea'], ['熱帯海を', 'tropical-sea'],
    ['氷山群を', 'icebergs'], ['流氷野を', 'drift-ice'], ['海嶺を', 'ocean-ridge'], ['海溝を', 'trench'],
    ['海山を', 'seamount'], ['大陸棚を', 'shelf'], ['大陸斜面を', 'slope'], ['深海平原を', 'abyssal-plain'],
    ['湧昇帯を', 'upwelling-zone'], ['潮境を', 'rip-current'], ['渦潮を', 'whirlpool'], ['潮流を', 'tidal-stream'],
    ['沿岸流を', 'coastal-drift'], ['環流を', 'gyre'], ['親潮を', 'oyashio'], ['対馬海流を', 'tsushima-current'],
    ['波頭を', 'wave-crests'], ['白波を', 'whitecaps'], ['うねりを', 'ocean-swell'], ['静水面を', 'calm-surface'],
    ['朝波を', 'morning-tide'], ['夕波を', 'evening-wave'], ['夜の海を', 'night-sea'], ['月光海を', 'moonlit-sea'],
    ['星あかりの海を', 'starry-sea'], ['白夜の海を', 'polar-day-sea'], ['極夜の海を', 'polar-night-sea'], ['薄明海を', 'twilight-sea'],
    ['光の筋を', 'sun-shafts'], ['マリンスノーを', 'marine-snow'], ['海霧を', 'sea-fog'], ['海風を', 'sea-breeze'],
    ['凪を', 'calm-waters'], ['時化を', 'rough-waters'], ['荒海を', 'wild-sea'], ['激浪を', 'surging-billows'],
    ['海溝底を', 'trench-floor'], ['海盆を', 'ocean-basin'], ['群島を', 'archipelago'], ['孤島群を', 'isolated-isles'],
    ['環礁を', 'atoll'], ['礁湖を', 'lagoon'], ['砂嘴を', 'sand-spit'], ['岬を', 'headland'],
    ['海蝕崖を', 'sea-cliff'], ['海中洞窟を', 'sea-cave'], ['海底谷を', 'submarine-canyon'], ['浅堆を', 'bank'],
    ['漁場を', 'feeding-grounds'], ['越冬海を', 'wintering-sea'], ['回遊路を', 'migratory-path'], ['繁殖海を', 'breeding-sea'],
    ['ゆりかごの海を', 'cradle-sea'], ['故郷の海を', 'home-waters'], ['旅路の海を', 'voyage-waters'], ['終着の海を', 'destination-sea'],
    ['泡沫の海を', 'foamy-sea'], ['飛沫の空を', 'spray-sky'], ['潮煙を', 'sea-spray'], ['水沫を', 'water-bubbles'],
    ['青の深淵を', 'blue-abyss'], ['碧の静寂を', 'green-silence'], ['蒼の広がりを', 'azure-expanse'], ['藍の底を', 'indigo-depth'],
    ['光降る海を', 'light-drenched-sea'], ['影射す海を', 'shadowed-sea'], ['澄んだ水界を', 'clear-realm'], ['濁り潮を', 'murky-tide'],
    ['冷水塊を', 'cold-eddy'], ['暖水塊を', 'warm-eddy'], ['潮間帯を', 'intertidal'], ['亜潮間帯を', 'subtidal'],
    ['日光層を', 'photic-zone'], ['黄昏層を', 'twilight-zone'], ['深海層を', 'midnight-zone'], ['超深海層を', 'hadal-zone'],
    ['水嶺を', 'water-divide'], ['海門を', 'sea-gate'], ['水路を', 'channel'], ['水道を', 'passage'],
    ['内海を', 'inland-waters'], ['湾奥を', 'bay-head'], ['湾口を', 'bay-mouth'], ['港外を', 'offing'],
    ['沖合を', 'offshore'], ['近海を', 'coastal-waters'], ['遠洋帯を', 'pelagic-realm'], ['公海を', 'open-ocean'],
    ['氷結海を', 'frozen-sea'], ['解氷海を', 'melting-sea'], ['初氷の海を', 'first-ice-sea'], ['蓮葉氷の海を', 'pancake-ice-sea'],
    ['定着氷の縁を', 'fast-ice-edge'], ['ポリニヤを', 'polynya'], ['氷間水路を', 'lead'], ['氷縁を', 'ice-edge'],
    ['春潮を', 'spring-tide'], ['小潮を', 'neap-tide'], ['若潮を', 'intermediate-tide'], ['長潮を', 'dull-tide'],
    ['大潮を', 'full-tide'], ['初汐を', 'first-tide'], ['返し波を', 'backwash'], ['引き波を', 'undertow'],
    ['砕波帯を', 'surf-zone'], ['離岸流を', 'rip-tide'], ['向かい潮を', 'head-tide'], ['追い潮を', 'fair-tide'],
    ['潮路の果てを', 'end-of-seaway'], ['海の彼方を', 'beyond-the-sea'], ['水平線の先を', 'beyond-horizon'], ['果てなき航路を', 'endless-course'],
    ['海原のただ中を', 'midst-of-waters'], ['深緑の水を', 'deep-green-water'], ['瑠璃の海を', 'lapis-sea'], ['琥珀の波を', 'amber-wave'],
    ['銀の水面を', 'silver-surface'], ['黄金の波を', 'golden-waves'], ['真珠の潮を', 'pearly-tide'], ['水晶の水底を', 'crystal-bottom'],
    ['東の海を', 'eastern-sea'], ['西の海を', 'western-sea'], ['南の海を', 'southern-sea'], ['北の海を', 'northern-sea'],
    ['極地の海を', 'polar-waters'], ['赤道の海を', 'equatorial-sea'], ['母なる海を', 'mother-sea'], ['生命の海を', 'sea-of-life'],
    ['静寂の淵を', 'abyss-of-silence'], ['永遠の海を', 'eternal-sea'], ['悠久の水を', 'ancient-waters'], ['無窮の大洋を', 'timeless-ocean'],
    ['幻の海を', 'phantom-sea'], ['夢の波路を', 'dream-course'], ['神秘の海域を', 'mystic-waters'], ['奇跡の海を', 'miracle-sea'],
    ['豊饒の海を', 'fertile-sea'], ['豊かな潮を', 'abundant-tide'], ['実りの海を', 'fruitful-sea'], ['魚群の海を', 'shoaling-sea'],
    ['鯨の道を', 'whale-way'], ['イルカの海を', 'dolphin-sea'], ['鳥舞う海を', 'seabird-waters'], ['魚憩う海を', 'fish-haven'],
    ['海境を', 'ocean-boundary'], ['波門を', 'wave-portal'], ['水鏡を', 'water-mirror'], ['潮泡の路を', 'path-of-foam'],
    ['青き旅路を', 'azure-voyage'], ['蒼の軌跡を', 'blue-wake'], ['水の回廊を', 'water-corridor'], ['潮の架け橋を', 'tidal-bridge'],
    ['海底山脈を', 'undersea-range'], ['海膨を', 'ocean-rise'], ['熱水鉱床を', 'hydrothermal-vent'], ['冷湧水域を', 'cold-seep'],
    ['鯨骨の海を', 'whales-fall-sea'], ['沈船の海を', 'shipwreck-sea'], ['サンゴ礁の海を', 'reef-waters'], ['海藻の森を', 'kelp-forest'],
    ['アラメの林を', 'seaweed-grove'], ['コンブの海を', 'kelp-sea'], ['アマモ場を', 'seagrass-meadow'], ['磯の波間を', 'tide-pool-waves'],
    ['沖ノ瀬を', 'outer-shoal'], ['潮岬を', 'tidal-cape'], ['海崖の麓を', 'cliff-base'], ['浜辺の波打際を', 'shoreline'],
    ['外洋の深部を', 'pelagic-depth'], ['表層の海を', 'surface-waters'], ['光届く海を', 'sunlit-depth'], ['暗黒の深海を', 'dark-abyss'],
    ['静かな湾内を', 'sheltered-bay'], ['風渡る海原を', 'wind-swept-sea'], ['白夜の入り江を', 'midnight-sun-cove'], ['極地の氷間を', 'polar-lead'],
    ['春めく海を', 'springtime-sea'], ['夏めく海を', 'summertime-sea'], ['秋澄む海を', 'autumn-clear-sea'], ['冬枯れの海を', 'winter-sea'],
    ['雨晴れの海を', 'post-rain-sea'], ['夕映えの海を', 'sunset-sea'], ['朝ぼらけの海を', 'daybreak-sea'], ['月光の航跡を', 'moonlit-wake'],
    ['星空映す海を', 'star-reflecting-sea'], ['天の川の海を', 'milky-way-sea'], ['潮風香る海を', 'breeze-scented-sea'], ['潮鳴りの海を', 'roaring-sea'],
    ['遠い海原を', 'far-off-ocean'], ['懐かしい海を', 'nostalgic-waters'], ['新しい海を', 'new-found-sea'], ['未来の海を', 'future-sea'],
    ['始まりの海を', 'origin-sea'], ['世界の海を', 'world-ocean'], ['すべての海を', 'all-oceans'], ['この碧き海を', 'this-emerald-sea'],
    ['珊瑚礁を', 'coral-reef'], ['藻場を', 'seaweed-bed'], ['潮溜まりを', 'tide-pool'], ['海食洞を', 'sea-hollow'],
    ['沖積世の海を', 'holocene-sea'], ['新世の海を', 'cenozoic-sea'], ['古生代の海を', 'paleozoic-sea'], ['始原海を', 'primordial-sea'],
    ['深海平原の底を', 'abyssal-floor'], ['海嶺の裂け目を', 'ridge-rift'], ['海膨の傾斜を', 'rise-slope'], ['海台を', 'ocean-plateau'],
    ['大洋底を', 'ocean-bed'], ['海淵を', 'ocean-deep'], ['深海谷を', 'deep-chasm'], ['暖流の縁を', 'warm-fringe'],
    ['寒流の縁を', 'cold-fringe'], ['潮のさざめきを', 'whispering-tide'], ['波の頂を', 'wave-zenith'], ['蒼海の涯を', 'azure-edge'],
    ['潮路の要所を', 'key-seaway'], ['海嘯の跡を', 'surge-wake'], ['凪の海面を', 'calmed-surface'], ['月下の水面を', 'moonlit-surface']
  ],
  verb: [
    ['巡る', 'cruising'], ['泳ぐ', 'swimming'], ['渡る', 'crossing'], ['漂う', 'drifting'],
    ['進む', 'gliding'], ['翔ける', 'soaring'], ['潜る', 'diving'], ['越える', 'spanning'],
    ['旅する', 'voyaging'], ['憩う', 'resting'], ['揺蕩う', 'floating'], ['見つめる', 'gazing'],
    ['遊ぶ', 'playing'], ['目指す', 'heading'], ['駆ける', 'dashing'], ['響かせる', 'resonating'],
    ['息づく', 'breathing'], ['跳ねる', 'leaping'], ['舞い上がる', 'breaching'], ['潮吹く', 'spouting'],
    ['鳴き交わす', 'calling'], ['群れる', 'podding'], ['追う', 'chasing'], ['食べる', 'lunging'],
    ['波打つ', 'surging'], ['漕ぎ出す', 'rowing'], ['導く', 'guiding'], ['見守る', 'watching'],
    ['見上げる', 'looking-up'], ['見渡す', 'surveying'], ['駆け抜ける', 'racing'], ['滑る', 'sliding'],
    ['切り裂く', 'cleaving'], ['切り拓く', 'parting'], ['かき分ける', 'plowing'], ['身を委ねる', 'entrusting'],
    ['乗り越える', 'conquering'], ['潜り抜ける', 'threading'], ['回遊する', 'migrating'], ['旋回する', 'circling'],
    ['反転する', 'turning'], ['翻る', 'banking'], ['しならせる', 'bending'], ['尾を振る', 'fluking'],
    ['打ち下ろす', 'stroking'], ['加速する', 'surging-ahead'], ['悠々と行く', 'prowling'], ['ゆったり進む', 'sauntering'],
    ['静かに佇む', 'lingering'], ['水面を割る', 'breaking-surface'], ['飛沫を上げる', 'splashing'], ['波紋を広げる', 'rippling'],
    ['音を紡ぐ', 'singing'], ['調べを奏でる', 'chanting'], ['波に乗る', 'wave-riding'], ['流れに乗る', 'current-riding'],
    ['風を感じる', 'feeling-breeze'], ['陽を浴びる', 'basking'], ['月を仰ぐ', 'moon-gazing'], ['星を仰ぐ', 'star-gazing'],
    ['深みへ下りる', 'descending'], ['浮上する', 'ascending'], ['息を継ぐ', 'surfacing'], ['海水を含む', 'engulfing'],
    ['海水を濾す', 'filtering'], ['喉を膨らます', 'ballooning'], ['口を開く', 'gape-opening'], ['満腹になる', 'satiating'],
    ['飢えを癒やす', 'nourishing'], ['魚を追う', 'fish-tracking'], ['オキアミを掬う', 'krill-scooping'], ['光を追う', 'light-seeking'],
    ['仲間と逢う', 'rendezvousing'], ['共に泳ぐ', 'co-swimming'], ['列をなす', 'aligning'], ['先頭を行く', 'leading'],
    ['後を追う', 'following'], ['並走する', 'paralleling'], ['寄り添う', 'nestling'], ['すれ違う', 'passing'],
    ['挨拶する', 'greeting'], ['合図を送る', 'signaling'], ['声を届ける', 'echoing'], ['波に乗せる', 'broadcasting'],
    ['深海を探る', 'exploring'], ['海底を撫でる', 'skimming'], ['岩礁を巡る', 'reef-rounding'], ['氷を避ける', 'ice-dodging'],
    ['氷海を抜ける', 'ice-breaking'], ['光の筋をくぐる', 'shaft-crossing'], ['泡をまとう', 'bubble-cloaked'], ['泡を放つ', 'bubble-releasing'],
    ['水膜を抜ける', 'film-piercing'], ['宙を舞う', 'air-bounding'], ['背中から落ちる', 'back-slamming'], ['腹を打つ', 'belly-flopping'],
    ['水煙をまとう', 'spray-shrouded'], ['白波を蹴る', 'wave-kicking'], ['推進力を生む', 'propelling'], ['巡航する', 'coasting'],
    ['スピードを上げる', 'speeding'], ['速度を緩める', 'slowing'], ['静止する', 'pausing'], ['微速で流れる', 'drifting-slow'],
    ['海流を遡る', 'upstream-swimming'], ['潮に乗って下る', 'downstream-drifting'], ['海峡を抜ける', 'strait-threading'], ['大海へ出る', 'ocean-entering'],
    ['故郷へ還る', 'homeward-bound'], ['新天地へ向かう', 'frontier-bound'], ['北へ旅立つ', 'northward-bound'], ['南へ下る', 'southward-bound'],
    ['東へ進路を取る', 'eastward-bound'], ['西へ向かう', 'westward-bound'], ['極点を目指す', 'poleward-heading'], ['赤道を目指す', 'equator-bound'],
    ['季節を追う', 'season-chasing'], ['春を迎える', 'spring-greeting'], ['夏を謳歌する', 'summer-rejoicing'], ['秋を感じる', 'autumn-sensing'],
    ['冬を越す', 'winter-surviving'], ['暖かさを求める', 'warmth-seeking'], ['冷たさを楽しむ', 'chill-relishing'], ['嵐をやり過ごす', 'storm-weathering'],
    ['凪を愛でる', 'calm-loving'], ['夜明けを迎える', 'dawn-welcoming'], ['夕陽を見送る', 'sunset-watching'], ['月夜を泳ぐ', 'moon-swimming'],
    ['星空の下を行く', 'starlight-gliding'], ['闇を照らす', 'illuminating'], ['白夜を味わう', 'polar-day-living'], ['極夜を耐える', 'polar-night-braving'],
    ['オーロラを仰ぐ', 'aurora-viewing'], ['マリンスノーを仰ぐ', 'snow-watching'], ['光の粒をこぼす', 'spark-shedding'], ['喜びを表現する', 'joy-expressing'],
    ['雄叫びをあげる', 'bellowing'], ['低い声で鳴く', 'low-moaning'], ['高い声で鳴く', 'high-whistling'], ['複雑に歌う', 'whale-singing'],
    ['波を震わせる', 'wave-vibrating'], ['海底に届かせる', 'bottom-reaching'], ['水平線の彼方へ響く', 'horizon-echoing'], ['命を繋ぐ', 'life-binding'],
    ['世代を重ねる', 'generations-spanning'], ['古の記憶を辿る', 'memory-tracing'], ['航路を覚える', 'route-remembering'], ['海図を描く', 'chart-mapping'],
    ['羅針盤を持つ', 'compass-bearing'], ['直感で進む', 'instinct-guided'], ['潮の匂いを嗅ぐ', 'tide-scenting'], ['水温を感じる', 'temp-sensing'],
    ['塩分を感じる', 'salinity-sensing'], ['水圧に抗う', 'pressure-braving'], ['深海に馴染む', 'depth-acclimating'], ['表層で戯れる', 'surface-frolicking'],
    ['太陽に近づく', 'sun-nearing'], ['空を感じる', 'sky-sensing'], ['風を聴く', 'wind-listening'], ['波音を聴く', 'wave-listening'],
    ['生き物に出会う', 'creature-meeting'], ['イルカと戯れる', 'dolphin-playing'], ['サメをやり過ごす', 'shark-passing'], ['ウミガメと並ぶ', 'turtle-flanking'],
    ['マンボウとすれ違う', 'mola-crossing'], ['ミズナギドリと舞う', 'bird-dancing'], ['鳥の影を見る', 'shadow-watching'], ['魚の群れを見つける', 'school-finding'],
    ['魚を囲い込む', 'fish-corraling'], ['一網打尽にする', 'gulper-sweeping'], ['喉を震わせる', 'throat-quivering'], ['満足げに漂う', 'content-drifting'],
    ['腹を満たす', 'belly-filling'], ['活力を得る', 'energy-gaining'], ['力をみなぎらせる', 'power-brimming'], ['優雅に身をくねらす', 'sinuous-moving'],
    ['力強く水を蹴る', 'water-kicking'], ['大きく翼を広げる', 'fin-spreading'], ['胸びれを羽ばたく', 'flipper-flapping'], ['舵をとる', 'steering'],
    ['姿勢を正す', 'posture-straightening'], ['傾きを直す', 'trim-adjusting'], ['水平を保つ', 'level-keeping'], ['垂直に立つ', 'vertically-standing'],
    ['宙返りする', 'looping'], ['ひねりを加える', 'twisting'], ['回転する', 'spinning'], ['転回する', 'revolving'],
    ['身を潜める', 'lurking'], ['姿を現す', 'revealing'], ['堂々と進む', 'proudly-gliding'], ['静謐に佇む', 'serenely-dwelling'],
    ['生命を讃える', 'life-praising'], ['海に感謝する', 'ocean-thanking'], ['地球を旅する', 'earth-voyaging'], ['時を刻む', 'time-marking'],
    ['物語を紡ぐ', 'tale-spinning'], ['軌跡を残す', 'trace-leaving'], ['記憶に刻む', 'engraving'], ['永遠を泳ぐ', 'forever-swimming'],
    ['世界を巡る', 'world-touring'], ['大海原に溶け込む', 'ocean-merging'], ['自然と一つになる', 'nature-uniting'], ['美しく生きる', 'fair-living'],
    ['明日へ向かう', 'tomorrow-bound'], ['光を目指す', 'light-aiming'], ['希望を運ぶ', 'hope-carrying'], ['夢を描く', 'dream-sketching'],
    ['歌を遺す', 'song-leaving'], ['旅を続ける', 'voyage-continuing'], ['未来へ泳ぐ', 'future-swimming'], ['悠久を渡る', 'eternity-crossing'],
    ['命を輝かせる', 'life-radiating'], ['波と語らう', 'wave-talking'], ['潮と踊る', 'tide-dancing'], ['永遠を生きる', 'eternal-living'],
    ['見送る', 'seeing-off'], ['迎え入れる', 'welcoming'], ['受け止める', 'embracing'], ['抱く', 'harboring'],
    ['呼び起こす', 'arousing'], ['かき鳴らす', 'strumming'], ['吹き上げる', 'blowing-up'], ['跳び跳ねる', 'skipping'],
    ['舞い降りる', 'alighting'], ['漂い流れる', 'meandering'], ['水底を覗く', 'bottom-peeking'], ['天を仰ぎ見る', 'sky-beholding'],
    ['光を浴びる', 'sun-bathing'], ['風をまとう', 'wind-clad'], ['波を割く', 'wave-cleaving'], ['潮を蹴立てる', 'tide-kicking'],
    ['水煙を散らす', 'spray-scattering'], ['波紋を残す', 'ripple-leaving'], ['泡を連ねる', 'bubble-trailing'], ['息を整える', 'breath-calming'],
    ['満腹を喜ぶ', 'fullness-rejoicing'], ['群れを統べる', 'school-marshaling'], ['仲間を気遣う', 'pod-tending'], ['挨拶を交わす', 'nod-greeting'],
    ['声に応える', 'voice-replying'], ['遠くへ届ける', 'broad-projecting'], ['海に溶け入る', 'sea-blending'], ['水と戯れる', 'water-sporting'],
    ['時を忘れる', 'time-forgetting'], ['静寂に浸る', 'silence-soaking'], ['深海に沈む', 'depth-sinking'], ['水面へ躍り出る', 'surface-bursting'],
    ['身を躍らせる', 'body-springing'], ['尾ひれを躍らす', 'fluke-prancing'], ['胸びれを広げる', 'flipper-furling'], ['背をかがめる', 'back-arching'],
    ['弧を描く', 'arc-tracing'], ['螺旋を描く', 'spiral-tracing'], ['真っ直ぐ進む', 'straight-coursing'], ['未来を見据える', 'future-gazing']
  ],
  noun: [
    ['クジラ', 'whale'], ['ナガスクジラ', 'fin-whale'], ['シロナガス', 'blue-whale'], ['ミンククジラ', 'minke-whale'],
    ['ニタリクジラ', 'bryde-whale'], ['ザトウクジラ', 'humpback'], ['南極ミンク', 'antarctic-minke'], ['カマイルカ', 'dolphin'],
    ['ヨシキリザメ', 'blue-shark'], ['アオウミガメ', 'sea-turtle'], ['マンボウ', 'sunfish'], ['ミズナギドリ', 'shearwater'],
    ['イカナゴ', 'sandlance'], ['シシャモ', 'capelin'], ['ニシン', 'herring'], ['カタクチイワシ', 'anchovy'],
    ['マイワシ', 'sardine'], ['サバ', 'mackerel'], ['ハダカイワシ', 'lanternfish'], ['ナンキョクオキアミ', 'antarctic-krill'],
    ['魚群', 'school-of-fish'], ['ベイトボール', 'bait-ball'], ['オキアミの群れ', 'krill-swarm'], ['海鳥の群れ', 'flock-of-birds'],
    ['イルカの群れ', 'dolphin-pod'], ['クジラの群れ', 'whale-pod'], ['母子クジラ', 'mother-and-calf'], ['若きクジラ', 'young-whale'],
    ['長老クジラ', 'elder-whale'], ['海の旅人', 'ocean-traveler'], ['深海の覇者', 'deep-ruler'], ['碧海の巨星', 'emerald-giant'],
    ['青き巨躯', 'blue-leviathan'], ['海のグレイハウンド', 'sea-greyhound'], ['海の歌い手', 'ocean-singer'], ['敏捷な泳ぎ手', 'agile-swimmer'],
    ['外洋の狩人', 'pelagic-hunter'], ['長寿の旅人', 'ancient-voyager'], ['海面の奇客', 'surface-wonder'], ['風切る翼', 'wind-wing'],
    ['銀鱗の群れ', 'silver-scales'], ['光る小魚', 'glowing-fry'], ['海の雫', 'ocean-drop'], ['海の妖精', 'sea-fairy'],
    ['海の友', 'ocean-friend'], ['深海の隣人', 'deep-neighbor'], ['波間の道連れ', 'wave-companion'], ['蒼海の探求者', 'azure-seeker'],
    ['海の魂', 'ocean-soul'], ['潮の精霊', 'tide-spirit'], ['水界の主', 'realm-lord'], ['偉大なる命', 'great-life'],
    ['小さき命', 'tiny-life'], ['無数の群れ', 'countless-throng'], ['銀の矢', 'silver-arrow'], ['青碧の影', 'teal-shadow'],
    ['真珠の泡', 'pearl-bubble'], ['潮吹く息吹', 'spouting-breath'], ['雄大なる尾びれ', 'grand-fluke'], ['翼のごとき胸びれ', 'wing-like-flipper'],
    ['美しい背びれ', 'graceful-dorsal'], ['畝ある喉', 'furrowed-throat'], ['クジラ髭', 'baleen-plates'], ['澄んだ瞳', 'crystal-eye'],
    ['ソナーの響き', 'sonar-ring'], ['海のささやき', 'ocean-whisper'], ['潮の調べ', 'tidal-song'], ['深海の低音', 'deep-tone'],
    ['高らかな口笛', 'high-whistle'], ['太古の記憶', 'primeval-memory'], ['悠久の旅路', 'ancient-voyage'], ['母なる海', 'mother-ocean'],
    ['父なる空', 'father-sky'], ['生命の海', 'sea-of-life'], ['青い惑星', 'blue-planet'], ['奇跡の水界', 'miracle-waters'],
    ['北の海原', 'northern-seas'], ['南の大洋', 'southern-ocean'], ['東の海域', 'eastern-waters'], ['西の波路', 'western-tide'],
    ['オホーツクの風', 'okhotsk-breeze'], ['黒潮の流れ', 'kuroshio-flow'], ['親潮の恵み', 'oyashio-bounty'], ['北大西洋の波', 'atlantic-waves'],
    ['南極海の氷', 'antarctic-ice'], ['知床の岬', 'shiretoko-cape'], ['土佐沖の潮', 'tosa-tide'], ['極北の光', 'arctic-light'],
    ['極夜の星', 'polar-star'], ['白夜の太陽', 'midnight-sun'], ['海上の月', 'ocean-moon'], ['深海の闇', 'deep-dark'],
    ['水面のきらめき', 'surface-glint'], ['光の柱', 'sunbeam-shaft'], ['マリンスノーの舞', 'snow-dance'], ['夜光虫の光', 'bioluminescence'],
    ['発光器の瞬き', 'photophore-spark'], ['虹色の飛沫', 'rainbow-spray'], ['白き波頭', 'white-crest'], ['静かなる凪', 'silent-calm'],
    ['荒波の咆哮', 'billow-roar'], ['海風の調べ', 'breeze-melody'], ['潮騒の音', 'surf-sound'], ['海流の鼓動', 'current-pulse'],
    ['地球の呼吸', 'earth-breath'], ['季節の風', 'seasonal-wind'], ['春告げ魚', 'spring-fish'], ['夏の光', 'summer-light'],
    ['秋の澄水', 'autumn-water'], ['冬の氷盤', 'winter-ice'], ['氷山の威容', 'berg-splendor'], ['流氷の原', 'drift-ice-field'],
    ['海底谷の深み', 'canyon-depth'], ['海嶺の峰', 'ridge-peak'], ['海山頂の平', 'guyot-crest'], ['深海平原の静寂', 'plain-silence'],
    ['大陸棚の賑わい', 'shelf-bustle'], ['珊瑚の庭', 'coral-garden'], ['海草の森', 'kelp-canopy'], ['磯の波', 'shore-wave'],
    ['遠浅の砂', 'shoal-sand'], ['青のグラデーション', 'blue-gradient'], ['藍の深淵', 'indigo-abyss'], ['碧の透明', 'emerald-clarity'],
    ['銀の航跡', 'silver-wake'], ['黄金の夕波', 'golden-crest'], ['真珠の薄明', 'pearly-dusk'], ['白銀の氷雪', 'silver-snow'],
    ['命の環', 'circle-of-life'], ['食物連鎖の恵み', 'trophic-bounty'], ['豊かな胃袋', 'satisfied-belly'], ['満ち足りた心', 'contented-heart'],
    ['健やかな身体', 'hale-body'], ['自由な魂', 'free-spirit'], ['誇り高き姿', 'noble-form'], ['悠然たる泳ぎ', 'serene-swimming'],
    ['力強いストローク', 'powerful-stroke'], ['流麗な反転', 'graceful-turn'], ['豪快なジャンプ', 'grand-breach'], ['空中の奇跡', 'aerial-miracle'],
    ['着水の轟音', 'splash-thunder'], ['広がる波紋', 'expanding-ripple'], ['共鳴する仲間', 'resonant-pod'], ['海の家族', 'ocean-family'],
    ['導きの声', 'guiding-voice'], ['友への歌', 'song-for-friends'], ['遠方への呼びかけ', 'distant-call'], ['返答のこだま', 'answering-echo'],
    ['海図なき航海', 'uncharted-voyage'], ['果てなき冒険', 'endless-adventure'], ['終わらぬ旅', 'ceaseless-journey'], ['安らぎの海', 'haven-sea'],
    ['約束の場所', 'promised-waters'], ['始まりの入り江', 'cove-of-beginnings'], ['遥かなる海原', 'far-off-expanse'], ['未知の深海', 'unknown-depths'],
    ['海の歴史', 'ocean-history'], ['水の記憶', 'water-memory'], ['波の語り部', 'wave-storyteller'], ['自然の知恵', 'nature-wisdom'],
    ['生命の神秘', 'mystery-of-life'], ['進化の軌跡', 'evolution-path'], ['美しき造形', 'fair-design'], ['完璧な流線型', 'perfect-streamline'],
    ['海の神殿', 'ocean-sanctuary'], ['青きオアシス', 'blue-oasis'], ['大いなる海原', 'immense-sea'], ['奇跡の海', 'miraculous-waters'],
    ['永遠の友', 'eternal-friend'], ['深海の守り人', 'deep-keeper'], ['海原の詩人', 'ocean-poet'], ['蒼茫の覇者', 'vast-sovereign'],
    ['銀の光', 'silver-gleam'], ['海の宝石', 'ocean-jewel'], ['波の華', 'wave-blossom'], ['潮の道標', 'tide-signpost'],
    ['希望の灯', 'hope-beacon'], ['明日への翼', 'wings-to-tomorrow'], ['未来の種', 'seed-of-future'], ['愛しき海', 'beloved-sea'],
    ['巨大クジラ', 'giant-whale'], ['ヒゲクジラ', 'baleen-whale'], ['ナガス属', 'rorqual-genus'], ['白銀の魚', 'silver-fish'],
    ['群青の海獣', 'ultramarine-beast'], ['碧落の友', 'azure-fellow'], ['深海の巨影', 'abyssal-giant'], ['水界の旅人', 'aquatic-traveler'],
    ['青き放浪者', 'blue-wanderer'], ['海の開拓者', 'ocean-pioneer'], ['海の巡礼者', 'ocean-pilgrim'], ['潮の航海者', 'tidal-navigator'],
    ['星見るクジラ', 'star-gazing-whale'], ['月待つクジラ', 'moon-waiting-whale'], ['朝焼けのクジラ', 'sunrise-whale'], ['夕暮れのクジラ', 'sunset-whale'],
    ['氷海の主', 'ice-sea-lord'], ['深海の哲学者', 'deep-philosopher'], ['波間の踊り子', 'wave-dancer'], ['海風の使者', 'breeze-herald'],
    ['潮鳴りの精', 'surf-nymph'], ['青の申し子', 'son-of-blue'], ['大洋の主', 'ocean-lord'], ['蒼穹の友', 'sky-companion'],
    ['銀海の泳者', 'silver-swimmer'], ['黄金の魚影', 'golden-silhouette'], ['水煙の主', 'spray-master'], ['白波の友', 'whitecap-friend'],
    ['凪の使者', 'calm-emissary'], ['時化の友', 'storm-mate'], ['光の案内人', 'light-guide'], ['影の追跡者', 'shadow-tracker'],
    ['海の道標', 'ocean-waymark'], ['生命の讃歌', 'life-hymn'], ['悠久の響き', 'ancient-chime'], ['未来への道', 'path-to-future'],
    ['希望の光', 'beacon-of-hope'], ['海原の祈り', 'ocean-prayer'], ['碧の奇跡', 'emerald-miracle'], ['蒼の至宝', 'azure-treasure'],
    ['深海の宝', 'deep-jewel'], ['潮の宝冠', 'tidal-crown'], ['水底の真珠', 'bottom-pearl'], ['波の王冠', 'wave-diadem'],
    ['海の守護神', 'ocean-guardian'], ['旅の守り手', 'voyage-warden'], ['海嶺の主', 'ridge-ruler'], ['海溝の番人', 'trench-keeper'],
    ['オホーツクの友', 'okhotsk-friend'], ['黒潮の友', 'kuroshio-friend'], ['大西洋の主', 'atlantic-lord'], ['南極海の勇者', 'antarctic-hero'],
    ['北の王者', 'northern-king'], ['南の王者', 'southern-king'], ['東の王者', 'eastern-king'], ['西の王者', 'western-king'],
    ['風の歌い手', 'wind-singer'], ['波の詩人', 'wave-poet'], ['潮の調律者', 'tidal-tuner'], ['海の芸術家', 'ocean-artist'],
    ['生命の巨木', 'tree-of-life'], ['悠久の巨神', 'ancient-titan'], ['大海の巨像', 'colossus-of-sea'], ['蒼茫の巨星', 'vast-star'],
    ['碧き巨鯨', 'emerald-whale'], ['白き巨鯨', 'white-whale'], ['黒き巨鯨', 'black-whale'], ['銀の巨鯨', 'silver-whale'],
    ['黄金の巨鯨', 'golden-whale'], ['光の巨鯨', 'luminous-whale'], ['星の巨鯨', 'stellar-whale'], ['月の巨鯨', 'lunar-whale'],
    ['太陽の巨鯨', 'solar-whale'], ['宇宙の巨鯨', 'cosmic-whale'], ['時空の巨鯨', 'spacetime-whale'], ['永遠の巨鯨', 'eternal-whale']
  ]
};

// 辞書サイズ確認
for (const k of ['adj', 'loc', 'verb', 'noun']) {
  if (DICT[k].length !== 256) throw new Error("dictionary length invalid: " + k);
}

// エンコード: saveオブジェクト -> 32bit整数 -> 4単語（日/英）
export function encodeSpell(data, lang = 'ja') {
  const AREAS = ['okhotsk', 'tosa', 'north_atlantic', 'antarctic'];
  const DEX = [
    'minke', 'antarctic_minke', 'bryde', 'fin', 'blue',
    'humpback', 'dolphin', 'shark', 'turtle', 'sunfish', 'shearwater',
    'sandlance', 'capelin', 'herring', 'anchovy', 'sardine', 'mackerel', 'lanternfish', 'krill'
  ];

  let clearedBits = 0;
  for (let i = 0; i < AREAS.length; i++) {
    if (data.cleared && data.cleared.includes(AREAS[i])) clearedBits |= (1 << i);
  }

  let areaIdx = AREAS.indexOf(data.area);
  if (areaIdx < 0) areaIdx = 0;

  let seenBits = 0;
  for (let i = 0; i < Math.min(18, DEX.length); i++) {
    if (data.seen && data.seen.includes(DEX[i])) seenBits |= (1 << i);
  }

  const ver = 0; // 3bit: 0..7
  const payload = ((ver & 0x7) << 24) | ((areaIdx & 0x3) << 22) | ((clearedBits & 0xF) << 18) | (seenBits & 0x3FFFF);

  // 5bit チェックサム
  let chk = 0;
  let tmp = payload;
  for (let b = 0; b < 27; b++) {
    if (tmp & 1) chk ^= (b * 7 + 13);
    tmp >>>= 1;
  }
  chk &= 0x1F;

  const full = ((payload >>> 0) << 5) | chk;
  const b0 = (full >>> 24) & 0xFF;
  const b1 = (full >>> 16) & 0xFF;
  const b2 = (full >>> 8) & 0xFF;
  const b3 = full & 0xFF;

  const li = (lang === 'en') ? 1 : 0;
  const w0 = DICT.adj[b0][li];
  const w1 = DICT.loc[b1][li];
  const w2 = DICT.verb[b2][li];
  const w3 = DICT.noun[b3][li];

  const phrase = [w0, w1, w2, w3].join(" ");
  const hex = (full >>> 0).toString(16).padStart(8, '0');
  return { phrase, hex, code: full >>> 0, words: [w0, w1, w2, w3] };
}

// デコード: 単語文字列 または 16進コード -> saveオブジェクト
export function decodeSpell(input) {
  if (!input) return null;
  const str = input.trim();
  const AREAS = ['okhotsk', 'tosa', 'north_atlantic', 'antarctic'];
  const DEX = [
    'minke', 'antarctic_minke', 'bryde', 'fin', 'blue',
    'humpback', 'dolphin', 'shark', 'turtle', 'sunfish', 'shearwater',
    'sandlance', 'capelin', 'herring', 'anchovy', 'sardine', 'mackerel', 'lanternfish', 'krill'
  ];

  let full = 0;
  if (/^[0-9a-fA-F]{8}$/.test(str)) {
    full = parseInt(str, 16) >>> 0;
  } else {
    const tokens = str.split(/[\s　・、,-]+/).filter(Boolean);
    if (tokens.length !== 4) return null;

    const findIdx = (cat, tok) => {
      const lower = tok.toLowerCase();
      for (let i = 0; i < 256; i++) {
        const [ja, en] = DICT[cat][i];
        if (ja === tok || en.toLowerCase() === lower) return i;
      }
      return -1;
    };

    const i0 = findIdx('adj', tokens[0]);
    const i1 = findIdx('loc', tokens[1]);
    const i2 = findIdx('verb', tokens[2]);
    const i3 = findIdx('noun', tokens[3]);

    if (i0 < 0 || i1 < 0 || i2 < 0 || i3 < 0) return null;
    full = ((i0 << 24) | (i1 << 16) | (i2 << 8) | i3) >>> 0;
  }

  const payload = (full >>> 5) & 0x7FFFFFF;
  const chk = full & 0x1F;

  let expChk = 0;
  let tmp = payload;
  for (let b = 0; b < 27; b++) {
    if (tmp & 1) expChk ^= (b * 7 + 13);
    tmp >>>= 1;
  }
  expChk &= 0x1F;

  if (chk !== expChk) return null;

  const ver = (payload >>> 24) & 0x7;
  const areaIdx = (payload >>> 22) & 0x3;
  const clearedBits = (payload >>> 18) & 0xF;
  const seenBits = payload & 0x3FFFF;

  const cleared = [];
  for (let i = 0; i < AREAS.length; i++) {
    if (clearedBits & (1 << i)) cleared.push(AREAS[i]);
  }

  const seen = [];
  for (let i = 0; i < Math.min(18, DEX.length); i++) {
    if (seenBits & (1 << i)) seen.push(DEX[i]);
  }

  return {
    cleared,
    seen,
    area: AREAS[areaIdx] || 'okhotsk',
    lang: 'ja'
  };
}
