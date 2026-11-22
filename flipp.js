// Panier futé - real flyer specials from Flipp (the same data the Flipp app shows).
// Works in the browser (CORS is open) and in Node 18+ (the GitHub robot). No key needed.
(function (root) {
  "use strict";
  const API = "https://backflipp.wishabi.com/flipp/items/search";
  const STORES = ["Maxi", "Super C", "IGA", "Metro", "Provigo", "Walmart", "Adonis"];
  const LB = 453.592;

  // ingredient id -> [Flipp search, words needed, words refused]
  // A word list is "a|b" (any of them). One word = start of a word in the name ("poitrine" finds "poitrines");
  // "=word" = exact word; text with a space = that exact phrase.
  const T = {
    poulet_poitrine: ["poitrines de poulet", ["poitrine", "poulet"], ["pane", "nugget", "croquette", "burger", "dinde", "cuit", "tranch", "fume", "bouillon", "soupe"]],
    poulet_cuisse: ["hauts de cuisse de poulet", ["cuisse", "poulet"], ["pane", "cuit", "dinde", "bouillon"]],
    poulet_pilon: ["pilons de poulet", ["pilon"], ["pane", "cuit", "dinde"]],
    poulet_entier: ["poulet entier", ["poulet", "entier"], ["cuit", "roti", "bbq", "barbecue"]],
    boeuf_hache: ["boeuf haché", ["boeuf", "hache"], ["burger", "galette", "boulette", "sauce", "lasagne"]],
    boeuf_cubes: ["cubes de boeuf à ragoût", ["boeuf", "ragout|cube|braiser"], ["soupe", "sauce", "conserve"]],
    boeuf_bifteck: ["bifteck", ["bifteck|steak|surlonge|faux filet|contre filet|entrecote|t bone|ribeye"], ["hache", "burger", "sauce", "epice", "assaison", "porc", "saumon", "thon", "chou"]],
    boeuf_roti: ["rôti de boeuf", ["roti", "boeuf"], ["tranch", "charcut", "sous vide", "cuit"]],
    porc_filet: ["filet de porc", ["filet", "porc"], ["bacon", "tranch", "fume"]],
    porc_epaule: ["épaule de porc", ["epaule", "porc"], ["fume", "effiloche", "cuit"]],
    porc_cotelettes: ["côtelettes de porc", ["cotelette", "porc"], ["fume", "cuit"]],
    cotes_levees: ["côtes levées", ["cotes levees|cote levee|cotes levee"], ["sauce", "cuit", "poulet", "boeuf"]],
    porc_hache: ["porc haché", ["porc", "hache"], ["burger", "galette", "boulette"]],
    saucisses: ["saucisses", ["saucisse"], ["hot dog", "wiener", "cocktail", "pain", "seche", "pepperoni"]],
    dinde_hachee: ["dinde hachée", ["dinde", "hache"], ["burger", "galette"]],
    jambon: ["jambon", ["jambon"], ["pizza", "sandwich", "pois", "soupe", "croquette"]],
    bacon: ["bacon", ["bacon"], ["bits", "miettes", "morceaux", "croustil", "burger", "saveur", "dinde"]],
    dinde_tranchee: ["dinde tranchée", ["dinde", "tranch|charcut|fume|roti de dinde|poitrine de dinde"], ["hache", "entiere", "burger", "galette"]],
    saumon: ["filet de saumon", ["saumon"], ["fume", "farci", "tournedos", "conserve", "boite", "roulade", "burger", "galette", "sushi", "pate", "mousse", "croquette", "nourriture"]],
    truite: ["truite", ["truite"], ["fume", "farci", "conserve"]],
    tilapia: ["tilapia", ["tilapia"], ["pane", "farci"]],
    crevettes: ["crevettes", ["crevette"], ["anneau", "cocktail", "pane", "tempura", "sauce", "croustil", "chips", "dumpling", "rouleau", "won"]],
    thon: ["thon en conserve", ["thon"], ["steak", "frais", "sushi", "longe", "tataki", "salade", "chat", "nourriture"]],
    oeufs: ["oeufs", ["oeuf"], ["chocolat", "paques", "nouille", "pate", "blanc d oeufs|blancs d oeufs", "liquide", "cuit", "kinder", "sandwich", "muffin"]],
    pois_chiches: ["pois chiches", ["pois chiche"], ["hummus", "houmous", "croustil", "farine", "pate"]],
    lentilles: ["lentilles", ["lentille"], ["soupe", "pate", "croustil", "chips"]],
    haricots_noirs: ["haricots noirs", ["haricot", "noir"], ["sauce", "soupe", "croustil"]],
    haricots_rouges: ["haricots rouges", ["haricot", "rouge"], ["sauce", "soupe"]],
    tofu: ["tofu", ["tofu"], ["dessert", "boisson", "pouding"]],
    oignon: ["oignons", ["oignon"], ["vert", "rondelle", "frit", "soupe", "poudre", "croustil", "trempette", "sauce", "rouge et", "marine", "perle"]],
    ail: ["ail", ["=ail"], ["poudre", "pain", "beurre", "sauce", "sel", "noir", "trempette", "croutons", "moulu", "aioli", "pate"]],
    carotte: ["carottes", ["carotte"], ["gateau", "muffin", "jus", "nourriture", "carrot cake", "surgel", "congel"]],
    celeri: ["céleri", ["celeri"], ["sel", "rave", "graine", "soupe"]],
    patate: ["pommes de terre", ["pommes de terre|pomme de terre|patate"], ["douce", "frite", "croustil", "chips", "pile", "salade", "pilee", "surgel", "congel", "galette", "pate", "gnocchi", "sachet", "pures"]],
    patate_douce: ["patates douces", ["patate|pomme de terre", "douce"], ["frite", "croustil", "chips", "surgel", "congel", "nourriture"]],
    poivron: ["poivrons", ["poivron"], ["grille", "farci", "pot", "rotis", "marine", "conserve", "sauce", "trempette"]],
    brocoli: ["brocoli", ["brocoli"], ["surgel", "congel", "salade", "chou fleur", "soupe", "melange"]],
    chou_fleur: ["chou-fleur", ["chou fleur|choux fleurs"], ["surgel", "congel", "riz", "pizza", "croute", "brocoli et", "gratin"]],
    courgette: ["courgettes", ["courgette|zucchini"], ["spirale", "surgel", "pates", "muffin", "pain"]],
    champignons: ["champignons", ["champignon"], ["soupe", "sauce", "conserve", "marine", "farci", "pizza", "creme", "seche"]],
    epinards: ["épinards", ["epinard"], ["surgel", "congel", "trempette", "pates", "tortilla", "spanakopita", "boulette", "pizza", "feuillete"]],
    laitue: ["laitue romaine", ["laitue|romaine"], ["salade cesar|kit|ensemble|melange"]],
    tomate: ["tomates", ["tomate"], ["cerise", "raisin", "conserve", "sauce", "pate", "jus", "en des", "seche", "ketchup", "soupe", "bruschetta", "salsa", "broye", "entieres en", "passata", "boite", "cocktail", "ml"]],
    tomate_cerise: ["tomates cerises", ["tomate", "cerise|raisin|cocktail|bouchee|melodie"], ["seche", "sauce", "conserve", "jus", "boite"]],
    concombre: ["concombres", ["concombre"], ["cornichon", "salade", "marine", "tzatziki", "eau", "boisson"]],
    poireau: ["poireaux", ["poireau"], ["soupe", "potage"]],
    chou: ["chou vert", ["=chou|=choux"], ["fleur", "fleurs", "bruxelles", "salade", "rave", "kale", "frise", "chinois", "nappa", "bok", "rouge", "brocoli", "creme", "cou", "farci", "coleslaw", "pak"]],
    citron: ["citrons", ["citron"], ["jus", "the", "vinaigrette", "gateau", "limonade", "boisson", "sorbet", "biscuit", "tarte", "yogourt", "eau", "lime", "saveur", "poivre", "aromat", "assaison", "muffin", "cari", "herbes"]],
    lime: ["limes", ["=lime|=limes"], ["jus", "limonade", "boisson", "biscuit", "tarte", "eau", "citron", "saveur", "tortilla", "croustil", "chips", "biere", "cooler"]],
    coriandre: ["coriandre", ["coriandre"], ["moulu", "graine", "seche", "pate"]],
    persil: ["persil", ["persil"], ["seche", "flocon"]],
    oignon_vert: ["oignons verts", ["oignon", "vert"], ["poudre", "trempette", "croustil", "creme sure"]],
    gingembre: ["gingembre", ["gingembre"], ["moulu", "biere", "ale", "the", "sauce", "boisson", "biscuit", "pate", "confit", "marine", "poudre", "soda", "shot"]],
    avocat: ["avocats", ["avocat"], ["huile", "guacamole", "trempette", "sushi", "toast", "mayo"]],
    feves_germees: ["fèves germées", ["feve|feves", "germe"], ["conserve"]],
    pois_mange_tout: ["pois mange-tout", ["mange tout|mangetout|pois sucres|pois sugar snap|sugar snap"], ["surgel", "melange"]],
    navet: ["navet", ["navet|rutabaga"], ["soupe", "frite"]],
    mais: ["maïs surgelé", ["=mais", "surgel|congel|grains"], ["creme", "conserve", "croustil", "chips", "tortilla", "huile", "farine", "fecule", "souffle", "pop", "sirop", "flocons", "galette"]],
    mais_conserve: ["maïs en crème", ["=mais", "creme|conserve|boite"], ["croustil", "chips", "huile", "surgel", "congel", "soupe"]],
    petits_pois: ["petits pois surgelés", ["petits pois|petit pois|pois verts"], ["carotte", "conserve", "chiche", "mange", "croustil", "soupe"]],
    legumes_mel: ["légumes surgelés", ["legume", "melange|surgel|congel"], ["soupe", "bouillon", "croustil", "chips", "pate", "riz", "nourriture", "jus", "sauce", "bebe", "puree", "boulette", "burger", "galette", "rouleau", "pizza", "trempette"]],
    lait: ["lait", ["=lait"], ["coco", "amande", "avoine", "soya", "soja", "chocolat", "frappe", "condense", "evapore", "beurre", "go", "glace", "poudre", "bebe", "maternise", "fermente", "kefir", "chai", "cafe", "latte", "biscuit", "dessert", "cacahuete", "noix", "riz", "pois", "nourrisson", "formule", "ml", "x", "creme", "fromage", "yogourt", "savon", "lotion", "corps", "nettoyant", "demaquill", "shampo", "hydrat", "solaire"]],
    creme: ["crème à cuisson", ["=creme"], ["glacee", "glace", "sure", "fromage", "dessert", "caramel", "soupe", "cafe", "crepe", "corps", "mains", "visage", "solaire", "rasage", "hydrat", "anti", "biscuit", "pouding", "brulee", "patissier", "chou", "tarte", "gateau", "mais", "bonbon", "lotion", "nettoyant", "cereale", "blé", "ble", "riz", "champignon", "poulet", "brocoli", "fouettee", "aerosol", "chocolat", "vanille", "nutella", "erable", "beurre", "mousse", "coupe", "barre", "sandwich"]],
    beurre: ["beurre", ["=beurre"], ["arachide", "amande", "pomme", "noix", "cacao", "sucre", "biscuit", "popcorn", "mais", "lait de beurre", "babeurre", "karite", "corps", "lotion", "erable", "poulet", "sauce", "tartinade", "croissant", "cookie", "graine", "soya", "tournesol", "bonbon", "galette", "cari", "chicken", "trempette", "noix de coco", "lait"]],
    mozzarella: ["mozzarella", ["mozzarella"], ["boccon", "pizza", "batonnet", "bouchee", "panee", "frite", "croquette"]],
    cheddar: ["cheddar", ["cheddar"], ["craquelin", "croustil", "chips", "macaroni", "goldfish", "pop", "bacon", "saucisse", "burger", "soupe", "sauce", "pain", "biscuit", "pretzel", "nachos"]],
    parmesan: ["parmesan", ["parmesan|parmigiano|grana"], ["sauce", "croutons", "vinaigrette", "croustil", "pain", "biscuit", "poulet", "veau", "aubergine", "pates"]],
    fromage_creme: ["fromage à la crème", ["fromage a la creme|philadelphia|fromage creme"], ["gateau", "bagel", "biscuit", "glacage", "trempette", "rangoon", "jalapeno", "won"]],
    creme_sure: ["crème sure", ["creme sure"], ["croustil", "chips", "trempette", "oignon"]],
    fromage_tranche: ["tranches de fromage", ["fromage", "tranch"], ["burger", "sandwich", "craquelin"]],
    yogourt: ["yogourt", ["yogourt|yaourt|yogurt"], ["glace", "glacee", "barre", "boisson", "a boire", "tube", "enrobe", "chien", "chat", "bebe", "pretzel", "raisins", "croustil", "biscuit", "nourriture", "cereale"]],
    feta: ["feta", ["feta"], ["pizza", "trempette", "spanakopita", "salade", "pate", "feuillete"]],
    pain_tranche: ["pain tranché", ["=pain|=pains"], ["kaiser", "hamburger", "hot", "burger", "naan", "pita", "baguette", "dore", "miettes", "gateau", "viande", "sous marin", "bagel", "croissant", "ail", "epice", "banane", "courgette", "mais", "sucre", "chocolat", "fromage", "sandwich", "chapelure", "pizza", "panini", "ciabatta", "tortilla", "brioche", "muffin", "pita", "croute", "plat", "pudding", "pouding", "farine", "levure", "machine", "grille", "papier", "cereale", "savon", "repas", "chiens", "chats", "sushi", "panettone"]],
    kaiser: ["pains kaiser", ["kaiser"], []],
    baguette: ["baguette", ["baguette"], ["pizza", "chips", "croustil", "fromage", "garnie", "sandwich", "ail"]],
    tortilla: ["tortillas", ["tortilla|wrap"], ["croustil", "chips", "nachos", "soupe", "trempette", "kit", "ensemble", "chips", "poulet", "porc"]],
    pita: ["pains pita", ["pita"], ["croustil", "chips", "craquelin", "trempette", "pizza"]],
    croissant: ["croissants", ["croissant"], ["surgel", "pate", "sandwich", "jambon", "pizza", "cereale"]],
    ciabatta: ["ciabatta", ["ciabatta"], ["pizza", "sandwich", "ail"]],
    bagel: ["bagels", ["bagel"], ["chips", "croustil", "pizza", "assaison", "epice", "crustil", "bouchees", "fromage a la creme"]],
    pain_sousmarin: ["pains sous-marin", ["sous marin|sous marins|hot dog|hot dogs|hamburger"], ["saucisse", "wiener", "boeuf", "galette", "surgel", "congel", "sauce", "relish", "moutarde", "bbq", "cuit", "garni", "pizza"]],
    pate_pizza: ["pâte à pizza", ["pate a pizza|pizza dough|croute a pizza|croutes a pizza"], ["sauce", "fromage"]],
    riz: ["riz", ["=riz"], ["basmati", "nouille", "galette", "gateau", "craquelin", "lait", "vinaigre", "farine", "boisson", "crispies", "papier", "pouding", "vermicelle", "cereale", "sauce", "poulet", "plat", "repas", "bebe", "chips", "croustil", "chou fleur", "choux fleurs", "brocoli", "sushi", "spaghetti", "pates", "bol", "son", "sirop", "biscuit", "barre", "galettes", "risotto", "accompagnement", "melange", "ble", "quinoa", "mais", "assaison"]],
    riz_basmati: ["riz basmati", ["riz", "basmati"], ["pret", "plat", "bol", "sachet micro", "accompagnement"]],
    pates: ["pâtes alimentaires", ["penne|rotini|fusilli|rigatoni|farfalle|pates alimentaires|pates seches|tortiglioni|cavatappi|bucatini|orzo|linguine|fettuccine|catelli|barilla|primo|italpasta|de cecco|pates"], ["sauce", "a pizza", "fraiches", "pret", "plat", "repas", "kit", "diner", "macaroni et fromage", "salade", "lasagne", "pate a", "pate de", "pate feuillet", "pate brisee", "pate de foie", "farcies", "farci", "ravioli", "tortellini", "gnocchi", "surgel", "congel", "chips", "soupe"]],
    spaghetti: ["spaghetti", ["spaghetti|spaghettini"], ["sauce", "courge", "boulette", "repas", "conserve", "plat", "surgel", "congel"]],
    macaroni: ["macaroni", ["macaroni|coudes"], ["fromage", "kraft", "diner", "salade", "plat", "repas", "surgel", "congel", "cheddar"]],
    lasagne: ["pâtes à lasagne", ["lasagne"], ["surgel", "congel", "sauce", "plat", "repas", "cuit", "pret", "familiale", "viande", "legumes", "fromage"]],
    nouilles_oeufs: ["nouilles aux oeufs", ["nouille", "oeuf"], ["soupe", "repas", "bol", "sauce", "poulet"]],
    nouilles_riz: ["nouilles de riz", ["nouille|vermicelle", "riz"], ["soupe", "repas", "bol", "sauce", "pret", "instantan"]],
    nouilles_lomein: ["nouilles lo mein", ["lo mein|ramen|udon|nouilles chinoises|chow mein"], ["soupe", "bol", "repas", "sauce", "instantan", "tasse", "saveur", "poulet", "boeuf", "crevette", "porc"]],
    couscous: ["couscous", ["couscous"], ["salade", "plat", "repas", "melange"]],
    quinoa: ["quinoa", ["quinoa"], ["salade", "plat", "repas", "croustil", "chips", "barre", "riz", "melange", "galette", "burger", "pates"]],
    orge: ["orge perlé", ["orge"], ["soupe", "boisson", "the", "farine", "malt"]],
    tomates_des: ["tomates en dés", ["tomate", "en des|broye|entiere|conserve|en boite|796"], ["sauce", "pate", "seche", "soupe", "jus", "ketchup", "salsa", "cerise", "raisin", "bruschetta", "fraiche", "serre", "grappe", "roma", "rouge", "lb", "kg"]],
    sauce_tomate: ["sauce tomate", ["passata|sauce tomate|sauce tomates|coulis de tomate|tomates tamisees"], ["pizza", "pates", "spaghetti", "viande", "boulette", "ketchup", "soupe"]],
    pate_tomate: ["pâte de tomate", ["pate de tomate|pate de tomates|concentre de tomate"], ["sauce", "pizza"]],
    bouillon_poulet: ["bouillon de poulet", ["bouillon", "poulet"], ["cube", "poudre", "soupe aux nouilles", "nouille", "base", "cubes", "concentre en"]],
    bouillon_boeuf: ["bouillon de boeuf", ["bouillon", "boeuf"], ["cube", "poudre", "soupe", "nouille", "base", "cubes"]],
    lait_coco: ["lait de coco", ["lait de coco|lait coco|coconut milk"], ["boisson", "yogourt", "glace", "dessert", "creme glacee", "eau de coco", "shampo", "lotion", "savon", "corps", "riz"]],
    chapelure: ["chapelure", ["chapelure|panko"], ["poulet", "poisson", "crevette", "fromage", "pane"]],
    farine: ["farine tout usage", ["farine"], ["mais", "riz", "amande", "coco", "pois", "sarrasin", "gateau", "crepe", "pain", "pizza", "chiche", "tapioca", "melange", "galette", "biscuit", "sans gluten", "noix", "avoine"]],
    salsa: ["salsa", ["salsa"], ["croustil", "chips", "nachos", "trempette", "poulet", "sauce", "cuisine", "danse", "verde"]],
    pesto: ["pesto", ["pesto"], ["pates", "poulet", "pizza", "pain", "sandwich", "trempette", "saumon", "tortellini", "ravioli", "gnocchi", "salade"]],
    sauce_bbq: ["sauce bbq", ["bbq|barbecue|b b q", "sauce"], ["croustil", "chips", "poulet", "porc", "cotes", "boeuf", "ailes", "burger", "pizza", "saucisse", "cuit", "charbon", "nettoyant", "brosse", "gril", "briquette", "propane"]],
    sauce_teriyaki: ["sauce teriyaki", ["teriyaki", "sauce"], ["poulet", "boeuf", "porc", "saumon", "repas", "bol", "nouille", "cuit"]],
    sauce_hoisin: ["sauce hoisin", ["hoisin"], ["poulet", "boeuf", "porc", "canard", "repas", "bol", "nouille", "cuit"]],
    vinaigrette_cesar: ["vinaigrette césar", ["cesar|caesar", "vinaigrette"], ["salade cesar|kit|ensemble", "croutons", "poulet", "chips", "croustil"]],
    ananas: ["ananas en conserve", ["ananas"], ["jus", "boisson", "yogourt", "gateau", "salsa", "pizza", "sorbet", "bonbon", "chips", "croustil", "sechees", "seche", "smoothie", "the", "eau"]],
    olives: ["olives", ["olive"], ["huile", "tapenade", "pizza", "pain", "trempette"]],
    huile: ["huile végétale", ["huile", "vegetale|canola|tournesol|=mais|soya"], ["olive", "sesame", "coco", "avocat", "aerosol", "moteur", "bebe", "corps", "massage", "essentielle", "vaporis", "cheveux", "lin", "poisson", "omega", "capsule", "cuiseur"]],
    huile_olive: ["huile d'olive", ["huile", "olive"], ["aerosol", "vaporis", "savon", "corps", "cheveux", "chips", "croustil", "pain", "tapenade", "thon", "sardine", "anchois", "artichaut", "tomates sechees", "olives", "pesto", "vinaigrette"]],
    sauce_soya: ["sauce soya", ["sauce", "soya|soja|tamari"], ["boisson", "lait", "tofu", "edamame", "germe", "chips", "croustil", "nouille", "repas", "huile", "lecithine", "teriyaki"]],
    moutarde: ["moutarde", ["moutarde"], ["miel et", "graine", "vinaigrette", "saucisse", "poulet", "porc", "chips", "croustil", "bretzel", "pretzel", "jambon"]],
    mayo: ["mayonnaise", ["mayonnaise|=mayo"], ["sandwich", "salade", "thon", "oeufs", "poulet", "vinaigrette", "sushi", "chips"]],
    ketchup: ["ketchup", ["ketchup"], ["chips", "croustil", "saveur", "assaison"]],
    miel: ["miel", ["=miel"], ["moutarde", "ail", "barbecue", "bbq", "cereale", "pain", "yogourt", "the", "noix", "jambon", "granola", "barre", "biscuit", "graham", "poulet", "ailes", "porc", "saumon", "jambon", "bonbon", "pastille", "sirop", "rince", "lotion", "savon", "shampo", "baume", "creme", "corps", "pop", "vinaigrette", "sauce"]],
    cassonade: ["cassonade", ["cassonade|sucre brun|sucre roux|sucre dore"], ["biscuit", "gruau", "avoine", "jambon", "sauce", "bonbon", "creme", "sirop"]],
    sucre: ["sucre", ["=sucre"], ["sans sucre", "cassonade", "glacer", "glace", "brun", "biscuit", "bonbon", "sucre a la creme", "gomme", "boisson", "sirop", "cereale", "erable", "pois sucres", "edulcorant", "succedane", "sucrette", "splenda", "barre", "tarte", "beigne", "gateau", "muffin", "chocolat", "coco", "barbe", "lime", "cannelle", "vanille", "pop", "mais", "grain", "fruit", "dore", "roux", "noix", "the", "cafe", "jus", "glaçage", "glacage", "petit", "moins"]],
    fecule: ["fécule de maïs", ["fecule"], ["pomme de terre", "tapioca"]],
    sriracha: ["sriracha", ["sriracha"], ["mayo", "chips", "croustil", "poulet", "ailes", "nouille", "ramen"]],
    worcestershire: ["sauce worcestershire", ["worcestershire"], ["chips", "croustil"]],
    huile_sesame: ["huile de sésame", ["huile", "sesame"], ["graine", "vinaigrette", "sauce"]],
    poivre: ["poivre noir moulu", ["=poivre"], ["poivron", "citron", "chips", "croustil", "saucisse", "bifteck", "steak", "salami", "sauce", "rose", "vert", "assaison", "sel et poivre", "melange", "moulin a", "jambon", "pepperoni", "dinde", "poulet", "boeuf", "porc", "fromage", "craquelin"]],
    sel: ["sel de table", ["=sel"], ["sans sel", "poivre", "ail", "celeri", "assaison", "croustil", "chips", "vinaigre", "noix", "arachide", "beurre", "bain", "epsom", "deglacage", "fondant", "adoucisseur", "chlorure", "piscine", "eau", "caramel", "chocolat", "biscuit", "craquelin", "bretzel", "pretzel", "pistache", "amande", "edamame", "morue", "sachets", "faible", "reduit", "graines", "tournesol", "cajou", "rose de l himalaya|himalaya", "fleur de sel", "fumee", "epices", "sel de mer et", "beurre", "pop", "mais"]],
  };
  const norm = (s) => String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  function has(nm, toks, w) {
    if (w.startsWith("=")) return toks.includes(w.slice(1));
    if (w.includes(" ")) return (" " + nm + " ").includes(" " + w + " ") || (" " + nm + " ").includes(" " + w);
    return toks.some((t) => t.startsWith(w));
  }
  function matches(id, name) {
    const t = T[id]; if (!t) return false;
    const all = norm(name), at = all.split(" ");
    if (!t[1].every((alts) => alts.split("|").some((w) => has(all, at, w)))) return false;
    if (t[2].some((w) => has(all, at, w))) return false;
    return true;
  }
  const storeOf = (m) => { m = norm(m); return STORES.find((s) => norm(s) === m) || null; };
  const day = (s) => String(s || "").slice(0, 10);

  async function search(q, postal, fetchFn) {
    const url = `${API}?locale=fr-ca&postal_code=${encodeURIComponent(postal)}&q=${encodeURIComponent(q)}`;
    const r = await (fetchFn || fetch)(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("Flipp " + r.status);
    const j = await r.json();
    return Array.isArray(j.items) ? j.items : [];
  }
  // Raw flyer items for the week starting `debut` (Thursday), only our 7 stores and only items we know
  async function collect(postal, debut, opts) {
    opts = opts || {};
    const ids = opts.ids || Object.keys(T);
    const friday = new Date(new Date(debut + "T12:00:00Z").getTime() + 864e5).toISOString().slice(0, 10);
    const seen = new Set(), out = [];
    let n = 0, fail = 0;
    for (const id of ids) {
      n++;
      if (opts.progress) opts.progress(n, ids.length);
      let items = [];
      try { items = await search(T[id][0], postal, opts.fetch); } catch (e) { if (++fail > 8) throw e; continue; }
      for (const it of items) {
        const mag = storeOf(it.merchant_name);
        if (!mag || !(Number(it.current_price) > 0)) continue;
        if (!(day(it.valid_from) <= friday && day(it.valid_to) >= friday)) continue;
        if (!matches(id, it.name)) continue;
        const key = id + "|" + (it.flyer_item_id || it.id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ing: id, mag, name: String(it.name || "").slice(0, 140), pre: it.pre_price_text || "", prix: Number(it.current_price),
          post: it.post_price_text || "", orig: Number(it.original_price) || 0, story: String(it.sale_story || "").slice(0, 60),
          img: it.clean_image_url || "", du: day(it.valid_from), au: day(it.valid_to) });
      }
      if (opts.pause) await new Promise((res) => setTimeout(res, opts.pause));
    }
    return out;
  }

  // Price -> what it buys, without AI. Returns {qte, unite} or null when the size is unknown.
  // usual count in one package, for "unit" ingredients sold in packs (used only when the AI can't tell)
  const PACK = { oeufs: 12, pain_tranche: 20, kaiser: 6, bagel: 6, tortilla: 10, pita: 6, croissant: 6, ciabatta: 4, pain_sousmarin: 6, fromage_tranche: 16, ail: 10 };
  const NUM = (s) => Number(String(s).replace(",", "."));
  function sizeOf(r, ingU) {
    const post = norm(r.post), nm = norm(r.name);
    const pm = String(r.pre || "").match(/^\s*(\d+)\s*(?:\/|pour\b)/i);
    const mult = pm ? Number(pm[1]) : 1;
    if (/(^| )lb( |$)/.test(post) || /^\/?\s*lb/.test(String(r.post).trim().toLowerCase())) return { qte: 1 * mult, unite: "lb" };
    if (/(^| )kg( |$)/.test(post)) return { qte: 1 * mult, unite: "kg" };
    let m = String(r.post).toLowerCase().match(/\/\s*100\s*g/);
    if (m) return { qte: 100, unite: "g" };
    const raw = String(r.name).toLowerCase().replace(/œ/g, "oe");
    m = raw.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lb)\b/);
    let q = null;
    if (m) q = { qte: Number(m[1]) * NUM(m[2]), unite: m[3] };
    else if ((m = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lb)\b/))) q = { qte: NUM(m[1]), unite: m[2] };
    if (q) { if (q.unite === "l") q.unite = "L"; q.qte *= mult; }
    if (ingU === "u") {
      if (/douzaine/.test(nm)) return { qte: 12 * mult, unite: "u" };
      m = raw.match(/(?:paq(?:uet)?\.?\s*de|pqt\s*de|sac\s*de|boite\s*de|caisse\s*de|emballage\s*de)\s*(\d+)(?!\s*(?:g|kg|ml|l|lb)\b)/) || raw.match(/\b(\d+)\s*(?:unites|un\.|pains|bagels|tortillas|croissants|pitas|oeufs|œufs)\b/);
      if (m) return { qte: Number(m[1]) * mult, unite: "u" };
      if (q || PACK[r.ing]) return null; // a size but not a count, or a pack of unknown count: ask the AI
      return { qte: 1 * mult, unite: "u" };
    }
    return q;
  }
  // Raw flyer items -> app specials {ing, mag, prix, qte, unite, txt}; the ones with an unknown size are returned apart
  function toItems(raw, ING, opts) {
    opts = opts || {};
    const items = [], unknown = [];
    for (const r of raw) {
      const ing = ING[r.ing]; if (!ing) continue;
      const fix = opts.sizes && opts.sizes[r.ing + "|" + r.name];
      if (fix && fix.skip) continue;
      let s = fix || sizeOf(r, ing.u);
      if (!s && opts.guess && ing.u === "u" && PACK[r.ing]) s = { qte: PACK[r.ing], unite: "u" };
      if (!s) { unknown.push(r); continue; }
      if (ing.u === "u" && s.unite !== "u") { unknown.push(r); continue; }
      if (ing.u === "g" && !["lb", "kg", "g"].includes(s.unite)) { unknown.push(r); continue; }
      if (ing.u === "ml" && !["L", "ml"].includes(s.unite)) { unknown.push(r); continue; }
      if (["cs", "ct"].includes(ing.u)) { unknown.push(r); continue; }
      items.push({ ing: r.ing, mag: r.mag, prix: r.prix, qte: s.qte, unite: s.unite, txt: pretty(r.name).slice(0, 90), img: r.img || "", reg: r.orig > r.prix ? r.orig : 0, story: r.story || "" });
    }
    return { items, unknown };
  }
  // "FILET DE SAUMON | FRESH SALMON" -> "Filet de saumon"
  function pretty(name) {
    let s = String(name || "").split(" | ")[0].trim();
    if (s === s.toUpperCase()) s = s.toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Keep the best price per ingredient and store (the app's flyer view stays readable)
  function bestPerStore(items, unitPrice, ING) {
    const best = {};
    for (const x of items) {
      const pu = unitPrice(x, ING[x.ing]); if (!(pu > 0)) continue;
      const k = x.ing + "|" + x.mag;
      if (!best[k] || pu < best[k].pu) best[k] = { pu, x };
    }
    return Object.values(best).map((b) => b.x);
  }

  const api = { STORES, TERMS: T, norm, matches, search, collect, sizeOf, toItems, pretty, bestPerStore, LB };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Flipp = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
