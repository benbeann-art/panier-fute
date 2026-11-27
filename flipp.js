// Panier futé - real flyer specials from Flipp (the same data the Flipp app shows).
// Works in the browser (CORS is open) and in Node 18+ (the GitHub robot). No key needed.
(function (root) {
  "use strict";
  const API = "https://backflipp.wishabi.com/flipp/items/search";
  const STORES = ["Maxi", "Super C", "IGA", "Metro", "Provigo", "Walmart", "Adonis", "Marché Tradition", "Tigre Géant", "Costco"];
  // Quebec regions whose flyers the GitHub robot keeps every week (the app picks the nearest one)
  const REGIONS = [
    ["mtl", "Montréal", "H2X1Y4", 45.55, -73.65], ["laval", "Laval", "H7N1A1", 45.57, -73.75], ["longueuil", "Longueuil / Rive-Sud", "J4K1A1", 45.53, -73.47],
    ["terrebonne", "Terrebonne", "J6W1A1", 45.70, -73.65], ["repentigny", "Repentigny", "J6A1A1", 45.75, -73.47], ["st-jerome", "Saint-Jérôme", "J7Z1A1", 45.78, -74.00],
    ["blainville", "Blainville / Sainte-Thérèse", "J7E1A1", 45.64, -73.84], ["mirabel", "Mirabel", "J7J1A1", 45.68, -74.08], ["vaudreuil", "Vaudreuil", "J7V1A1", 45.40, -74.03],
    ["chateauguay", "Châteauguay", "J6J1A1", 45.36, -73.75], ["st-jean", "Saint-Jean-sur-Richelieu", "J3B1A1", 45.31, -73.26], ["granby", "Granby", "J2G1A1", 45.40, -72.73],
    ["st-hyacinthe", "Saint-Hyacinthe", "J2S1A1", 45.63, -72.96], ["drummondville", "Drummondville", "J2B1A1", 45.88, -72.48], ["st-liboire", "Saint-Liboire", "J0H1R0", 45.65, -72.76],
    ["sorel", "Sorel-Tracy", "J3P1A1", 46.04, -73.11], ["joliette", "Joliette", "J6E1A1", 46.02, -73.44], ["salaberry", "Salaberry-de-Valleyfield", "J6T1A1", 45.25, -74.13],
    ["sherbrooke", "Sherbrooke", "J1H1A1", 45.40, -71.89], ["magog", "Magog", "J1X1A1", 45.27, -72.15], ["cowansville", "Cowansville", "J2K1A1", 45.20, -72.75],
    ["victoriaville", "Victoriaville", "G6P1A1", 46.05, -71.96], ["trois-rivieres", "Trois-Rivières", "G9A1A1", 46.35, -72.55], ["shawinigan", "Shawinigan", "G9N1A1", 46.57, -72.75],
    ["quebec", "Québec", "G1R1A1", 46.81, -71.21], ["levis", "Lévis", "G6V1A1", 46.74, -71.25], ["st-georges", "Saint-Georges", "G5Y1A1", 46.12, -70.67],
    ["thetford", "Thetford Mines", "G6G1A1", 46.09, -71.30], ["montmagny", "Montmagny", "G5V1A1", 46.98, -70.55], ["riviere-du-loup", "Rivière-du-Loup", "G5R1A1", 47.83, -69.53],
    ["rimouski", "Rimouski", "G5L1A1", 48.45, -68.52], ["matane", "Matane", "G4W1A1", 48.85, -67.53], ["gaspe", "Gaspé", "G4X1A1", 48.83, -64.48],
    ["saguenay", "Saguenay", "G7H1A1", 48.43, -71.07], ["alma", "Alma", "G8B1A1", 48.55, -71.65], ["baie-comeau", "Baie-Comeau", "G4Z1A1", 49.22, -68.15],
    ["sept-iles", "Sept-Îles", "G4R1A1", 50.21, -66.38], ["gatineau", "Gatineau", "J8Y1A1", 45.48, -75.70], ["rouyn", "Rouyn-Noranda", "J9X1A1", 48.24, -79.02],
    ["val-dor", "Val-d'Or", "J9P1A1", 48.10, -77.78], ["ste-adele", "Sainte-Adèle / Laurentides", "J8B1A1", 45.95, -74.13], ["mont-laurier", "Mont-Laurier", "J9L1A1", 46.55, -75.50],
    ["lachute", "Lachute", "J8H1A1", 45.65, -74.33],
  ].map(([id, name, postal, lat, lon]) => ({ id, name, postal, lat, lon }));
  const distKm = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const nearestRegion = (p, maxKm) => { let best = null, d = 1e9; for (const r of REGIONS) { const x = distKm(p, r); if (x < d) { d = x; best = r; } } return best && d <= (maxKm || 35) ? best : null; };
  const ALIAS = { "les marches tradition": "Marché Tradition", "marches tradition": "Marché Tradition", "marche tradition": "Marché Tradition", "tigre geant": "Tigre Géant", "giant tiger": "Tigre Géant", "costco wholesale": "Costco", "costco": "Costco" };
  const LB = 453.592;

  // ingredient id -> [Flipp search, words needed, words refused]
  // A word list is "a|b" (any of them). One word = start of a word in the name ("poitrine" finds "poitrines");
  // "=word" = exact word; text with a space = that exact phrase.
  const T = {
    poulet_poitrine: ["poitrines de poulet", ["poitrine", "poulet"], ["pane", "nugget", "croquette", "burger", "dinde", "cuit", "tranch", "fume", "bouillon", "soupe", "farci", "fondue", "tournedos", "assaison", "marine", "chimichurri", "bbq"]],
    poulet_cuisse: ["hauts de cuisse de poulet", ["cuisse", "poulet"], ["pane", "cuit", "dinde", "bouillon"]],
    poulet_pilon: ["pilons de poulet", ["pilon"], ["pane", "cuit", "dinde"]],
    poulet_entier: ["poulet entier", ["poulet", "entier"], ["cuit", "roti", "bbq", "barbecue", "chien", "chat", "nourriture", "assaison", "portugais"]],
    boeuf_hache: ["boeuf haché", ["boeuf", "hache"], ["burger", "galette", "boulette", "sauce", "lasagne", "simili"]],
    boeuf_cubes: ["cubes de boeuf à ragoût", ["boeuf", "ragout|cube|braiser"], ["soupe", "sauce", "conserve", "cordon"]],
    boeuf_bifteck: ["bifteck", ["bifteck|steak|surlonge|faux filet|contre filet|entrecote|t bone|ribeye"], ["hache", "burger", "sauce", "epice", "assaison", "porc", "saumon", "thon", "chou", "jambon", "=ham"]],
    boeuf_roti: ["rôti de boeuf", ["roti", "boeuf"], ["tranch", "charcut", "sous vide", "cuit", "bouillon", "base", "saveur"]],
    porc_filet: ["filet de porc", ["filet", "porc"], ["bacon", "tranch", "fume"]],
    porc_epaule: ["épaule de porc", ["epaule", "porc"], ["fume", "effiloche", "cuit", "agneau", "veau"]],
    porc_cotelettes: ["côtelettes de porc", ["cotelette", "porc"], ["fume", "cuit"]],
    cotes_levees: ["côtes levées", ["cotes levees|cote levee|cotes levee"], ["sauce", "cuit", "poulet", "boeuf", "mais", "facon"]],
    porc_hache: ["porc haché", ["porc", "hache"], ["burger", "galette", "boulette"]],
    saucisses: ["saucisses", ["saucisse"], ["hot dog", "wiener", "cocktail", "pain", "seche", "pepperoni", "hors", "vegetal", "vegan"]],
    dinde_hachee: ["dinde hachée", ["dinde", "hache"], ["burger", "galette"]],
    jambon: ["jambon", ["jambon"], ["pizza", "sandwich", "pois", "soupe", "croquette", "prosciutto", "salami", "flocon"]],
    bacon: ["bacon", ["bacon"], ["bits", "miettes", "morceaux", "croustil", "burger", "saveur", "dinde", "poulet", "tortellini", "genre"]],
    dinde_tranchee: ["dinde tranchée", ["dinde", "tranch|charcut|fume|roti de dinde|poitrine de dinde"], ["hache", "entiere", "burger", "galette", "sans peau"]],
    saumon: ["filet de saumon", ["saumon"], ["fume", "farci", "tournedos", "conserve", "boite", "roulade", "burger", "galette", "sushi", "pate", "mousse", "croquette", "nourriture", "truite"]],
    truite: ["truite", ["truite"], ["fume", "fumoir", "farci", "conserve"]],
    tilapia: ["tilapia", ["tilapia"], ["pane", "farci"]],
    sole: ["filets de sole", ["=sole"], ["pane", "farci", "fume", "frit"]],
    riz_arborio: ["riz arborio", ["arborio|risotto"], ["pret", "plat", "sachet", "champignon", "fromage", "repas", "bol"]],
    lard_sale: ["lard salé", ["=lard", "=sale"], ["feve", "beans", "haricot", "fume"]],
    pois_jaunes: ["pois jaunes cassés", ["pois", "jaune"], ["soupe", "conserve", "habitant", "potage"]],
    semoule_mais: ["semoule de maïs", ["semoule|polenta", "mais|polenta"], ["pret", "tube", "cuite"]],
    crevettes: ["crevettes", ["crevette"], ["anneau", "cocktail", "pane", "pates", "surimi", "batonnet", "poisson", "goberge", "salade", "bouchee", "moghrabieh", "tempura", "sauce", "croustil", "chips", "dumpling", "rouleau", "won", "bol", "popcorn", "couronne", "coco", "papillon", "brochette"]],
    thon: ["thon en conserve", ["thon"], ["steak", "frais", "sushi", "longe", "tataki", "salade", "chat", "nourriture"]],
    oeufs: ["oeufs", ["oeuf"], ["chocolat", "paques", "nouille", "pate", "blanc d oeufs|blancs d oeufs", "liquide", "cuit", "kinder", "sandwich", "muffin"]],
    pois_chiches: ["pois chiches", ["pois chiche"], ["trempette", "hummus", "houmous", "croustil", "farine", "pate"]],
    lentilles: ["lentilles", ["lentille"], ["soupe", "pate", "croustil", "chips"]],
    haricots_noirs: ["haricots noirs", ["haricot", "noir"], ["sauce", "soupe", "croustil"]],
    haricots_rouges: ["haricots rouges", ["haricot", "rouge"], ["sauce", "soupe"]],
    tofu: ["tofu", ["tofu"], ["dessert", "boisson", "pouding"]],
    oignon: ["oignons", ["oignon"], ["brochette", "kafta", "merguez", "vert", "rondelle", "frit", "soupe", "poudre", "croustil", "trempette", "sauce", "rouge et", "marine", "perle"]],
    ail: ["ail", ["=ail"], ["poudre", "pain", "beurre", "sauce", "sel", "noir", "trempette", "croutons", "moulu", "aioli", "pate", "hache", "derlea", "puree", "confit"]],
    carotte: ["carottes", ["carotte"], ["gateau", "muffin", "jus", "nourriture", "carrot cake", "surgel", "congel"]],
    celeri: ["céleri", ["celeri"], ["sel", "rave", "graine", "soupe"]],
    patate: ["pommes de terre", ["pommes de terre|pomme de terre|patate"], ["douce", "frite", "rondelle", "quartier", "croustil", "chips", "pile", "salade", "pilee", "surgel", "congel", "galette", "pate", "gnocchi", "sachet", "pures"]],
    patate_douce: ["patates douces", ["patate|pomme de terre", "douce"], ["frite", "croustil", "chips", "surgel", "congel", "nourriture"]],
    poivron: ["poivrons", ["poivron"], ["grille", "farci", "pot", "rotis", "marine", "conserve", "sauce", "trempette"]],
    brocoli: ["brocoli", ["brocoli"], ["surgel", "congel", "salade", "chou fleur", "soupe", "melange"]],
    chou_fleur: ["chou-fleur", ["chou fleur|choux fleurs"], ["surgel", "congel", "riz", "pizza", "croute", "brocoli et", "gratin"]],
    courgette: ["courgettes", ["courgette|zucchini"], ["spirale", "surgel", "pates", "muffin", "pain"]],
    champignons: ["champignons", ["champignon"], ["soupe", "sauce", "conserve", "marine", "farci", "pizza", "creme", "seche", "fromage", "gouda", "vtech", "construction", "jouet", "maison champignon", "ens"]],
    epinards: ["épinards", ["epinard"], ["surgel", "congel", "trempette", "pates", "tortilla", "spanakopita", "boulette", "pizza", "feuillete", "hache", "cedar", "ravioli", "nouille", "fromage", "tortellini"]],
    laitue: ["laitue romaine", ["laitue|romaine"], ["salade cesar|kit|ensemble|melange"]],
    tomate: ["tomates", ["tomate"], ["cerise", "raisin", "conserve", "sauce", "pate", "jus", "en des", "seche", "ketchup", "soupe", "bruschetta", "salsa", "broye", "entieres en", "passata", "boite", "cocktail", "ml", "aylmer", "hunt", "primo", "conserve", "coulis", "compliments"]],
    tomate_cerise: ["tomates cerises", ["tomate", "cerise|raisin|cocktail|bouchee|melodie"], ["seche", "sauce", "conserve", "jus", "boite", "pain", "roquette"]],
    concombre: ["concombres", ["concombre"], ["cornichon", "salade", "marine", "tzatziki", "eau", "boisson"]],
    poireau: ["poireaux", ["poireau"], ["soupe", "potage"]],
    chou: ["chou vert", ["=chou|=choux"], ["fleur", "fleurs", "bruxelles", "salade", "rave", "kale", "frise", "chinois", "nappa", "bok", "rouge", "brocoli", "creme", "cou", "farci", "coleslaw", "pak"]],
    citron: ["citrons", ["citron"], ["jus", "the", "vinaigrette", "gateau", "limonade", "boisson", "sorbet", "biscuit", "tarte", "yogourt", "eau", "lime", "saveur", "poivre", "aromat", "assaison", "muffin", "cari", "herbes", "pandoro", "confiture", "creme", "tartinade", "marmelade"]],
    lime: ["limes", ["=lime|=limes"], ["jus", "limonade", "boisson", "biscuit", "tarte", "eau", "citron", "saveur", "tortilla", "croustil", "chips", "biere", "cooler"]],
    coriandre: ["coriandre", ["coriandre"], ["moulu", "graine", "seche", "pate"]],
    persil: ["persil", ["persil"], ["seche", "flocon"]],
    oignon_vert: ["oignons verts", ["oignon", "vert"], ["poudre", "trempette", "croustil", "creme sure"]],
    gingembre: ["gingembre", ["gingembre"], ["moulu", "biere", "ale", "the", "sauce", "boisson", "biscuit", "pate", "confit", "marine", "poudre", "soda", "shot", "sushi"]],
    avocat: ["avocats", ["avocat"], ["huile", "guacamole", "trempette", "sushi", "toast", "mayo"]],
    feves_germees: ["fèves germées", ["feve|feves", "germe"], ["conserve"]],
    pois_mange_tout: ["pois mange-tout", ["mange tout|mangetout|pois sucres|pois sugar snap|sugar snap"], ["surgel", "melange"]],
    navet: ["navet", ["navet|rutabaga"], ["soupe", "frite", "marine", "piment"]],
    mais: ["maïs surgelé", ["=mais", "surgel|congel|grains"], ["creme", "conserve", "croustil", "chips", "tortilla", "huile", "farine", "fecule", "souffle", "pop", "sirop", "flocons", "galette", "eclater", "micro"]],
    mais_conserve: ["maïs en crème", ["=mais", "creme|conserve|boite"], ["croustil", "chips", "huile", "surgel", "congel", "soupe"]],
    petits_pois: ["petits pois surgelés", ["petits pois|petit pois|pois verts"], ["carotte", "conserve", "chiche", "mange", "croustil", "soupe"]],
    legumes_mel: ["légumes surgelés", ["legume", "melange|surgel|congel"], ["soupe", "bouillon", "croustil", "chips", "pate", "riz", "nourriture", "jus", "sauce", "bebe", "puree", "boulette", "burger", "galette", "rouleau", "pizza", "trempette"]],
    lait: ["lait", ["=lait"], ["coco", "amande", "avoine", "soya", "soja", "chocolat", "frappe", "condense", "concentre", "eagle", "evapore", "beurre", "go", "glace", "poudre", "bebe", "maternise", "fermente", "kefir", "chai", "cafe", "latte", "biscuit", "dessert", "cacahuete", "noix", "riz", "pois", "nourrisson", "formule", "ml", "x", "creme", "fromage", "yogourt", "savon", "lotion", "corps", "nettoyant", "demaquill", "shampo", "hydrat", "solaire"]],
    creme: ["crème à cuisson", ["=creme"], ["glacee", "glace", "sure", "fromage", "dessert", "caramel", "soupe", "cafe", "crepe", "corps", "mains", "visage", "solaire", "rasage", "hydrat", "anti", "biscuit", "pouding", "brulee", "patissier", "chou", "tarte", "gateau", "mais", "bonbon", "lotion", "nettoyant", "cereale", "blé", "ble", "riz", "champignon", "poulet", "brocoli", "fouettee", "aerosol", "chocolat", "vanille", "nutella", "erable", "beurre", "mousse", "coupe", "barre", "sandwich"]],
    beurre: ["beurre", ["=beurre"], ["arachide", "amande", "pomme", "noix", "cacao", "sucre", "biscuit", "popcorn", "mais", "lait de beurre", "babeurre", "karite", "corps", "lotion", "erable", "poulet", "sauce", "tartinade", "croissant", "cookie", "graine", "soya", "tournesol", "bonbon", "galette", "cari", "chicken", "trempette", "noix de coco", "lait"]],
    mozzarella: ["mozzarella", ["mozzarella"], ["boccon", "pizza", "batonnet", "bouchee", "panee", "frite", "croquette"]],
    cheddar: ["cheddar", ["cheddar"], ["craquelin", "croustil", "chips", "macaroni", "goldfish", "pop", "bacon", "saucisse", "burger", "soupe", "sauce", "pain", "biscuit", "pretzel", "nachos"]],
    parmesan: ["parmesan", ["parmesan|parmigiano|grana"], ["sauce", "croutons", "vinaigrette", "croustil", "pain", "biscuit", "poulet", "veau", "aubergine", "pates", "fondue", "hors", "saucisse"]],
    fromage_creme: ["fromage à la crème", ["fromage a la creme|philadelphia|fromage creme"], ["gateau", "bagel", "biscuit", "glacage", "trempette", "rangoon", "jalapeno", "won"]],
    creme_sure: ["crème sure", ["creme sure"], ["croustil", "chips", "trempette", "oignon"]],
    fromage_tranche: ["tranches de fromage", ["fromage", "tranch"], ["burger", "sandwich", "craquelin"]],
    yogourt: ["yogourt", ["yogourt|yaourt|yogurt"], ["glace", "glacee", "barre", "boisson", "a boire", "tube", "enrobe", "chien", "chat", "bebe", "pretzel", "raisins", "croustil", "biscuit", "nourriture", "cereale"]],
    feta: ["feta", ["feta"], ["pizza", "trempette", "spanakopita", "salade", "pate", "feuillete"]],
    pain_tranche: ["pain tranché", ["=pain|=pains"], ["raisin", "kaiser", "hamburger", "hot", "burger", "naan", "pita", "baguette", "dore", "miettes", "gateau", "viande", "sous marin", "bagel", "croissant", "ail", "epice", "banane", "courgette", "mais", "sucre", "chocolat", "fromage", "sandwich", "chapelure", "pizza", "panini", "ciabatta", "tortilla", "brioche", "muffin", "pita", "croute", "plat", "pudding", "pouding", "farine", "levure", "machine", "grille", "papier", "cereale", "savon", "repas", "chiens", "chats", "sushi", "panettone", "croustille", "chips"]],
    kaiser: ["pains kaiser", ["kaiser"], []],
    baguette: ["baguette", ["baguette"], ["pizza", "chips", "croustil", "fromage", "garnie", "sandwich", "ail", "craquelin", "grissol", "melba"]],
    tortilla: ["tortillas", ["tortilla|wrap"], ["croustil", "chips", "nachos", "soupe", "trempette", "kit", "ensemble", "chips", "poulet", "porc", "mais", "coquille", "snack"]],
    pita: ["pains pita", ["pita"], ["croustil", "chips", "craquelin", "trempette", "pizza"]],
    croissant: ["croissants", ["croissant"], ["surgel", "pate", "sandwich", "jambon", "pizza", "cereale"]],
    ciabatta: ["ciabatta", ["ciabatta"], ["pizza", "sandwich", "ail", "boeuf", "poulet", "jambon", "dinde"]],
    bagel: ["bagels", ["bagel"], ["chips", "croustil", "pizza", "assaison", "epice", "crustil", "bouchees", "fromage a la creme"]],
    pain_hotdog: ["pains à hot-dog", ["pain", "hot dog"], ["saucisse", "wiener", "surgel", "congel", "garni", "kit"]],
    pain_burger: ["pains à hamburger", ["pain", "hamburger|burger"], ["galette", "boeuf", "poulet", "porc", "surgel", "congel", "garni", "kit", "sauce", "vegetal"]],
    wieners: ["saucisses à hot-dog", ["wiener|hot dog"], ["pain", "pains", "relish", "moutarde", "sauce", "vegetal", "vegan", "pogo", "enrob", "pate", "chips", "croustil", "kit"]],
    kd: ["kraft dinner", ["kraft dinner|diner kraft|macaroni et fromage|macaroni au fromage|mac and cheese|mac et fromage"], ["surgel", "congel", "bol", "coupe", "tasse", "micro", "pret", "repas", "salade", "sauce", "gratine", "maison"]],
    pain_sousmarin: ["pains sous-marin", ["sous marin|sous marins"], ["saucisse", "wiener", "boeuf", "galette", "surgel", "congel", "sauce", "relish", "moutarde", "bbq", "cuit", "garni", "pizza"]],
    pate_pizza: ["pâte à pizza", ["pate a pizza|pizza dough|croute a pizza|croutes a pizza"], ["sauce", "fromage"]],
    riz: ["riz", ["=riz"], ["basmati", "express", "minute", "instantane", "precuit", "nouille", "galette", "gateau", "craquelin", "lait", "vinaigre", "farine", "boisson", "crispies", "papier", "pouding", "vermicelle", "cereale", "sauce", "poulet", "plat", "repas", "bebe", "chips", "croustil", "chou fleur", "choux fleurs", "brocoli", "sushi", "spaghetti", "pates", "bol", "son", "sirop", "biscuit", "barre", "galettes", "risotto", "accompagnement", "melange", "ble", "quinoa", "mais", "assaison", "arborio", "risotto"]],
    riz_basmati: ["riz basmati", ["riz", "basmati"], ["pret", "plat", "bol", "sachet micro", "accompagnement"]],
    pates: ["pâtes alimentaires", ["penne|rotini|fusilli|rigatoni|farfalle|pates alimentaires|pates seches|tortiglioni|cavatappi|bucatini|orzo|linguine|fettuccine|catelli|barilla|primo|italpasta|de cecco|pates"], ["sauce", "a pizza", "fraiches", "pret", "plat", "repas", "kit", "diner", "macaroni et fromage", "salade", "lasagne", "pate a", "pate de", "pate feuillet", "pate brisee", "pate de foie", "farcies", "farci", "ravioli", "tortellini", "gnocchi", "surgel", "congel", "chips", "soupe"]],
    spaghetti: ["spaghetti", ["spaghetti|spaghettini"], ["sauce", "courge", "boulette", "repas", "conserve", "plat", "surgel", "congel"]],
    macaroni: ["macaroni", ["macaroni|coudes"], ["fromage", "kraft", "diner", "salade", "plat", "repas", "surgel", "congel", "cheddar"]],
    lasagne: ["pâtes à lasagne", ["lasagne"], ["surgel", "congel", "sauce", "plat", "repas", "cuit", "pret", "familiale", "viande", "legumes", "fromage"]],
    nouilles_oeufs: ["nouilles aux oeufs", ["nouille", "oeuf"], ["soupe", "repas", "bol", "sauce", "poulet"]],
    nouilles_riz: ["nouilles de riz", ["nouille|vermicelle", "riz"], ["soupe", "repas", "bol", "sauce", "pret", "instantan"]],
    nouilles_lomein: ["nouilles lo mein", ["lo mein|ramen|udon|nouilles chinoises|chow mein"], ["soupe", "bol", "repas", "sauce", "instantan", "tasse", "saveur", "poulet", "boeuf", "crevette", "porc"]],
    couscous: ["couscous", ["couscous"], ["salade", "plat", "repas", "melange"]],
    quinoa: ["quinoa", ["quinoa"], ["salade", "plat", "repas", "croustil", "chips", "barre", "riz", "melange", "galette", "burger", "pates", "legume"]],
    orge: ["orge perlé", ["orge"], ["soupe", "boisson", "the", "farine", "malt"]],
    tomates_des: ["tomates en dés", ["tomate", "en des|broye|entiere|conserve|en boite|796"], ["sauce", "pate", "seche", "soupe", "jus", "ketchup", "salsa", "cerise", "raisin", "bruschetta", "fraiche", "serre", "grappe", "roma", "rouge", "lb", "kg"]],
    sauce_tomate: ["sauce tomate", ["passata|sauce tomate|sauce tomates|coulis de tomate|tomates tamisees"], ["pizza", "pates", "spaghetti", "viande", "boulette", "ketchup", "soupe"]],
    pate_tomate: ["pâte de tomate", ["pate de tomate|pate de tomates|concentre de tomate"], ["sauce", "pizza"]],
    bouillon_poulet: ["bouillon de poulet", ["bouillon", "poulet"], ["cube", "poudre", "soupe aux nouilles", "nouille", "base", "cubes", "concentre en"]],
    bouillon_legumes: ["bouillon de légumes", ["bouillon", "legume"], ["cube", "poudre", "soupe", "nouille", "base", "cubes", "concentre en", "poulet", "boeuf"]],
    // snacks, coffee, nuts and drinks (not in recipes): compared between stores per 100 g / per litre (Costco too)
    k_chips: ["croustilles", ["croustille|chips|ruffles|lays|doritos|miss vickie|kettle chips|croustilles kettle|pringles|old dutch"], ["tortilla", "bagel", "pita", "pomme", "legume", "trempette", "salsa", "chocolat", "bonbon"]],
    k_chocolat: ["chocolat", ["chocolat|lindt|lindor|godiva|ferrero|toblerone|cadbury|hershey|kinder"], ["lait au chocolat", "boisson", "cereale", "biscuit", "gateau", "muffin", "pouding", "glace", "lait", "croissant", "chaud", "tartinade", "nutella", "barre tendre", "granola", "pepite", "brisure", "cuisson", "fondue", "patisserie"]],
    k_cafe: ["café", ["=cafe|cafe moulu|cafe en grains|cafe entier|cafe torrefie"], ["capsule", "k cup", "kcup", "dosette", "instantane", "creme", "cafetiere", "glace", "tasse", "infuse", "latte", "pod", "biscuit", "gateau", "chocolat", "liqueur", "machine"]],
    k_cafe_inst: ["café instantané", ["instantane"], ["the", "soupe", "nouille", "gruau", "pouding", "riz", "capsule"]],
    k_noix: ["noix", ["noix de cajou|cajou|amandes|pistaches|noix melangees|noix de grenoble|pacanes|noisettes"], ["beurre", "lait", "boisson", "barre", "chocolat", "biscuit", "cereale", "huile", "farine", "yogourt", "olive", "baguette", "pain"]],
    k_craquelins: ["craquelins", ["craquelin|triscuit|ritz|=dare|breton|wheat thins|crackers"], ["fromage a la creme", "soupe", "porc", "croissant"]],
    k_canneberges: ["canneberges séchées", ["canneberge|craisins"], ["jus", "cocktail", "sauce", "boisson", "fraiche", "surgel"]],
    k_eau_gaz: ["eau pétillante", ["eau petillante|eau gazeifiee|perrier|pellegrino|bubly|montellier|eska petillante"], ["jus", "vin", "biere"]],
    k_biere: ["bière", ["=biere|bieres"], ["racinette", "gingembre", "pain", "marinade", "chocolat", "bonbon", "sauce", "moutarde"]],
    bouillon_boeuf: ["bouillon de boeuf", ["bouillon", "boeuf"], ["cube", "poudre", "soupe", "nouille", "base", "cubes"]],
    lait_coco: ["lait de coco", ["lait de coco|lait coco|coconut milk"], ["boisson", "yogourt", "glace", "dessert", "creme glacee", "eau de coco", "shampo", "lotion", "savon", "corps", "riz", "bain", "moussant"]],
    chapelure: ["chapelure", ["chapelure|panko"], ["poulet", "poisson", "crevette", "fromage", "pane"]],
    farine: ["farine tout usage", ["farine"], ["mais", "riz", "amande", "coco", "pois", "sarrasin", "gateau", "crepe", "pain", "pizza", "chiche", "tapioca", "melange", "galette", "biscuit", "sans gluten", "noix", "avoine"]],
    salsa: ["salsa", ["salsa"], ["croustil", "chips", "nachos", "trempette", "poulet", "sauce", "cuisine", "danse", "verde"]],
    pesto: ["pesto", ["pesto"], ["pates", "poulet", "pizza", "pain", "sandwich", "trempette", "saumon", "tortellini", "ravioli", "gnocchi", "salade"]],
    sauce_bbq: ["sauce bbq", ["bbq|barbecue|b b q", "sauce"], ["croustil", "chips", "poulet", "porc", "cotes", "boeuf", "ailes", "burger", "pizza", "saucisse", "cuit", "charbon", "nettoyant", "brosse", "gril", "briquette", "propane"]],
    sauce_teriyaki: ["sauce teriyaki", ["teriyaki", "sauce"], ["poulet", "boeuf", "porc", "saumon", "repas", "bol", "nouille", "cuit"]],
    sauce_hoisin: ["sauce hoisin", ["hoisin"], ["poulet", "boeuf", "porc", "canard", "repas", "bol", "nouille", "cuit"]],
    vinaigrette_cesar: ["vinaigrette césar", ["cesar|caesar", "vinaigrette"], ["salade cesar|kit|ensemble", "croutons", "poulet", "chips", "croustil"]],
    ananas: ["ananas en conserve", ["ananas"], ["jus", "boisson", "yogourt", "gateau", "salsa", "pizza", "sorbet", "bonbon", "chips", "croustil", "sechees", "seche", "smoothie", "the", "eau"]],
    olives: ["olives", ["olive"], ["huile", "tapenade", "pizza", "pain", "trempette", "bruschetta"]],
    huile: ["huile végétale", ["huile", "vegetale|canola|tournesol|=mais|soya"], ["olive", "sesame", "coco", "avocat", "aerosol", "moteur", "bebe", "corps", "massage", "essentielle", "vaporis", "cheveux", "lin", "poisson", "omega", "capsule", "cuiseur"]],
    huile_olive: ["huile d'olive", ["huile", "olive"], ["aerosol", "vaporis", "savon", "corps", "cheveux", "chips", "croustil", "pain", "tapenade", "thon", "sardine", "anchois", "artichaut", "tomates sechees", "olives", "pesto", "vinaigrette"]],
    sauce_soya: ["sauce soya", ["sauce", "soya|soja|tamari"], ["boisson", "lait", "tofu", "edamame", "germe", "chips", "croustil", "nouille", "repas", "huile", "lecithine", "teriyaki"]],
    moutarde: ["moutarde", ["moutarde"], ["miel et", "graine", "vinaigrette", "saucisse", "poulet", "porc", "chips", "croustil", "bretzel", "pretzel", "jambon"]],
    mayo: ["mayonnaise", ["mayonnaise|=mayo"], ["sandwich", "salade", "thon", "oeufs", "poulet", "vinaigrette", "sushi", "chips"]],
    ketchup: ["ketchup", ["ketchup"], ["chips", "croustil", "saveur", "assaison"]],
    miel: ["miel", ["=miel"], ["moutarde", "ail", "barbecue", "bbq", "cereale", "pain", "yogourt", "the", "noix", "jambon", "granola", "barre", "biscuit", "graham", "poulet", "ailes", "porc", "saumon", "jambon", "bonbon", "pastille", "sirop", "rince", "lotion", "savon", "shampo", "baume", "creme", "corps", "pop", "vinaigrette", "sauce", "poire"]],
    cassonade: ["cassonade", ["cassonade|sucre brun|sucre roux|sucre dore"], ["biscuit", "gruau", "avoine", "jambon", "sauce", "bonbon", "creme", "sirop"]],
    sucre: ["sucre", ["=sucre"], ["sans sucre", "cassonade", "glacer", "glace", "brun", "biscuit", "bonbon", "sucre a la creme", "gomme", "boisson", "sirop", "cereale", "erable", "pois sucres", "edulcorant", "succedane", "sucrette", "splenda", "barre", "tarte", "beigne", "gateau", "muffin", "chocolat", "coco", "barbe", "lime", "cannelle", "vanille", "pop", "mais", "grain", "fruit", "dore", "roux", "noix", "the", "cafe", "jus", "glaçage", "glacage", "petit", "moins"]],
    fecule: ["fécule de maïs", ["fecule"], ["pomme de terre", "tapioca"]],
    sriracha: ["sriracha", ["sriracha"], ["mayo", "chips", "croustil", "poulet", "ailes", "nouille", "ramen"]],
    worcestershire: ["sauce worcestershire", ["worcestershire"], ["chips", "croustil"]],
    huile_sesame: ["huile de sésame", ["huile", "sesame"], ["graine", "vinaigrette", "sauce"]],
    panais: ["panais", ["panais"], ["soupe", "croustil", "chips"]],
    pate_tarte: ["pâte à tarte", ["pate a tarte|croute a tarte|abaisse|pate brisee"], ["pizza", "tarte aux", "tarte au", "tartelette"]],
    sirop_erable: ["sirop d'érable", ["sirop", "erable"], ["saveur", "biscuit", "cereale", "gruau", "bacon", "jambon", "saucisse", "bonbon", "beurre", "tire", "sucre", "the", "cafe", "creme", "yogourt", "barre", "noix"]],
    fromage_grains: ["fromage en grains", ["fromage", "grain|grains|crottes"], ["poutine kit", "chips"]],
    aubergine: ["aubergines", ["aubergine"], ["trempette", "baba", "parmigiana", "grille", "marine"]],
    pomme: ["pommes", ["=pomme|=pommes"], ["terre", "jus", "compote", "compte", "applesnax", "collation", "coupe", "tarte", "chips", "croustil", "sauce", "cidre", "vinaigre", "chausson", "muffin", "barre", "boisson", "puree", "gateau", "beigne", "cannelle et", "sechees", "pain", "yogourt", "gourde", "collation", "frite", "rondelle"]],
    ricotta: ["ricotta", ["ricotta"], ["ravioli", "cannelloni", "pizza", "lasagne", "tortellini", "gateau"]],
    gnocchi: ["gnocchis", ["gnocchi"], ["sauce", "repas", "plat"]],
    haricots_blancs: ["haricots blancs", ["haricot|haricots|feve", "blanc|cannellini|romano"], ["sauce", "soupe", "lard", "beans", "au lard"]],
    haricots_verts: ["haricots verts", ["haricot", "vert|jaune"], ["surgel", "congel", "conserve", "boite", "salade"]],
    courge: ["courge musquée", ["courge|butternut"], ["soupe", "potage", "ravioli", "surgel", "spaghetti", "puree", "muffin", "courgette", "zucchini"]],
    kale: ["chou kale", ["kale|frise"], ["chips", "croustil", "salade cesar", "salade de", "smoothie", "persil"]],
    gruyere: ["fromage gruyère", ["gruyere|suisse|emmental|jarlsberg"], ["tranche", "pain", "chips", "craquelin", "fondue", "quiche", "sandwich", "saucisse"]],
    poivre: ["poivre noir moulu", ["=poivre"], ["poivron", "citron", "chips", "croustil", "saucisse", "bifteck", "steak", "salami", "sauce", "rose", "vert", "assaison", "sel et poivre", "melange", "moulin a", "jambon", "pepperoni", "dinde", "poulet", "boeuf", "porc", "fromage", "craquelin"]],
    // snacks (Collations tab)
    banane: ["bananes", ["banane"], ["plantain", "chips", "croustil", "pain", "muffin", "yogourt", "barre", "sechee", "seche", "nourriture", "bebe", "smoothie", "boisson", "gateau", "puree", "collation"]],
    poire: ["poires", ["=poire|=poires"], ["jus", "conserve", "coupe", "nectar", "sechee", "yogourt", "compote", "gourde", "boisson"]],
    clementine: ["clémentines", ["clementine|mandarine"], ["jus", "conserve", "coupe", "yogourt", "boisson", "gelee"]],
    orange: ["oranges", ["=orange|=oranges"], ["jus", "boisson", "marmelade", "saveur", "chocolat", "poivron", "carotte", "patate", "courge", "yogourt", "bonbon", "gelee", "nectar", "the", "tisane", "cheddar", "poudre", "emergen", "effervesc"]],
    raisins: ["raisins", ["raisin"], ["sec", "secs", "sultana", "jus", "gelee", "pain", "biscuit", "muffin", "cereale", "yogourt", "vinaigre", "huile", "confiture", "boisson", "chocolat", "bagel", "son", "tomate", "panettone", "confit", "gateau", "brioche", "corinthe"]],
    bleuets: ["bleuets", ["bleuet"], ["muffin", "yogourt", "jus", "confiture", "gaufre", "barre", "pain", "cereale", "seche", "sauce", "tarte", "boisson", "the", "gelee", "pancake", "crepe"]],
    fraises: ["fraises", ["fraise"], ["confiture", "yogourt", "jus", "gelee", "boisson", "barre", "saveur", "sirop", "tarte", "bonbon", "the", "lait", "creme glacee", "gateau", "smoothie", "rhubarbe et", "melange", "mangue"]],
    avoine: ["flocons d'avoine", ["avoine|gruau"], ["barre", "biscuit", "cereale", "boisson", "lait", "sachet", "instantane", "saveur", "muffin", "pain", "son d", "granola", "galette", "bouchee"]],
    dattes: ["dattes", ["datte"], ["carre", "barre", "biscuit", "pain", "muffin", "sirop"]],
    raisins_secs: ["raisins secs", ["raisin", "sec|secs|sultana"], ["pain", "biscuit", "cereale", "bagel", "muffin", "son", "chocolat", "yogourt", "enrobe"]],
    graines_tournesol: ["graines de tournesol", ["tournesol", "graine"], ["huile", "beurre", "pain", "craquelin", "barre", "oiseau", "semence", "margarine", "tartinade", "saveur", "pacane"]],
    graines_citrouille: ["graines de citrouille", ["citrouille|courge", "graine"], ["pain", "huile", "barre", "craquelin", "semence", "oiseau"]],
    mais_eclater: ["maïs à éclater", ["mais", "eclater|souffle"], ["micro", "beurre", "caramel", "prepare", "saveur", "kettle", "chocolat", "fromage", "sucre", "chips"]],
    beurre_tournesol: ["beurre de tournesol", ["tournesol", "beurre|tartinade"], ["huile", "margarine", "biscuit", "barre"]],
    edamame: ["edamames", ["edamame|feve de soya|feves de soya"], ["sec", "chips", "croustil", "pate", "nouille", "sauce", "boisson", "lait", "salade"]],
    farine_ble: ["farine de blé entier", ["farine", "ble entier|entier"], ["pain", "craquelin", "tortilla", "pita", "pates", "biscuit", "muffin", "melange", "spaghetti"]],
    graines_lin: ["graines de lin", ["lin", "graine|moulu"], ["huile", "pain", "craquelin", "cereale", "barre", "bagel"]],
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
  // a product the filters reject for this ingredient (only the "not this" words: AI-read names are often short)
  function excluded(id, name) { const t = T[id]; if (!t || !name) return false; const all = norm(name), at = all.split(" "); return t[2].some((w) => has(all, at, w)); }
  const storeOf = (m) => { m = norm(m); return ALIAS[m] || STORES.find((s) => norm(s) === m) || null; };
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
        out.push({ ing: id, mag, fid: it.flyer_item_id || it.id, name: String(it.name || "").slice(0, 140), pre: it.pre_price_text || "", prix: Number(it.current_price),
          post: it.post_price_text || "", orig: Number(it.original_price) || 0, story: String(it.sale_story || "").slice(0, 60),
          img: it.clean_image_url || "", du: day(it.valid_from), au: day(it.valid_to) });
      }
      // searches at a human pace: a random wait between pause and pauseMax
      if (opts.pause) await new Promise((res) => setTimeout(res, opts.pause + Math.random() * Math.max(0, (opts.pauseMax || opts.pause) - opts.pause)));
    }
    if (opts.details !== false) await addDetails(out, Object.assign({}, opts, { pause: opts.detailPause }));
    return out;
  }

  // Fruits and vegetables: the search result often hides "the pound, when you buy a 4 lb bag: 3,96 $ the bag".
  // That text is in the item's own page: read it for these items and fix the price and size.
  const PRODUCE = new Set(["ail", "pomme", "poire", "orange", "clementine", "citron", "lime", "banane", "raisins", "bleuets", "fraises", "concombre", "poivron", "tomate", "tomate_cerise",
    "carotte", "patate", "patate_douce", "oignon", "celeri", "brocoli", "chou_fleur", "chou", "courgette", "champignons", "avocat", "laitue", "poireau", "navet", "ananas", "courge", "aubergine", "pois_mange_tout"]);
  const DETAIL = new Map();
  async function detailOf(id, fetchFn) {
    if (DETAIL.has(id)) return DETAIL.get(id);
    const f = fetchFn || fetch;
    let d = "";
    for (let k = 0; k < 2 && !d; k++) {
      try {
        const r = await f("https://backflipp.wishabi.com/flipp/items/" + id, { headers: { accept: "application/json" } });
        if (r.ok) { const j = await r.json(); const it = j.item || j; d = String(it.description || "") + " " + String(it.post_price_text || ""); }
      } catch (e) {}
    }
    DETAIL.set(id, d);
    return d;
  }
  const addSize = (x, t) => { const h = x.name.split(" | ")[0]; if (h === h.toUpperCase()) t = t.toUpperCase(); x.name = /\s\|\s/.test(x.name) ? x.name.replace(/\s\|\s/, " " + t + " | ") : x.name + " " + t; };
  function applyDetail(x, desc) {
    const d = String(desc || "").toLowerCase().replace(/\s+/g, " ");
    if (!d.trim()) return x;
    if (/^\s*ch/i.test(x.post || "") && /(?<![\d,.\/$])\d+(?:[.,]\d+)?\s*(kg|lb)\b(?!\s*\/)/.test(d)) x.post = ""; // "ch." on a 3 lb bag
    const bag = d.match(/(\d+[.,]\d{2})\s*\$\s*(?:le|la|par)\s*(sac|filet|caisse|boite|boîte|paquet|emballage|contenant|barquette)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(lb|kg|g)\b/);
    if (bag) { x.prix = NUM(bag[1]); addSize(x, `${bag[2]} de ${bag[3]} ${bag[4]}`); x.post = ""; return x; }
    if (/^\s*ch/i.test(x.post || "") && !/\b(ch|chacun|chacune|l'unité|unité)\b/.test(d) && (/(sac|filet)/.test(d))) x.post = ""; // "ch." printed on a bag
    const size = d.match(/(sac|filet|caisse|boite|boîte|paquet|emballage|contenant|barquette)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(lb|kg|g)\b/);
    const perLb = /la livre|le lb|la lb|\/\s*lb|par livre/.test(d);
    const perKg = /\/\s*kg|le kg|par kg/.test(d);
    if (perLb && size && /l'achat|achat d/.test(d)) {
      // per-pound price, sold only in a bag: the bag price is what you pay
      const lb = size[3] === "kg" ? NUM(size[2]) * 2.2046 : size[3] === "g" ? NUM(size[2]) / 453.6 : NUM(size[2]);
      x.prix = Math.round(x.prix * lb * 100) / 100; addSize(x, `${size[1]} de ${size[2]} ${size[3]}`); x.post = ""; return x;
    }
    if (perLb && (!x.post || /^\s*ch/i.test(x.post))) { x.post = "/lb"; return x; }
    if (perKg && !x.post) { x.post = "/kg"; return x; }
    if (size && !/\d\s*(lb|kg|g)\b/.test(x.name.toLowerCase())) { addSize(x, `${size[1]} de ${size[2]} ${size[3]}`); return x; }
    // a plain weight in the description ("Produits du Québec 907 g", "1,36 kg"): the size of the package (not "4,39/kg", a price)
    const mx = !x.post && !size && d.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/);
    const w = !x.post && !size && d.match(/(?<![\d,.\/$x×])(\d+(?:[.,]\d+)?)\s*(kg|g|lb|ml|l)\b(?!\s*\/)/);
    if (mx && !/\d\s*(lb|kg|g|ml|l)\b/.test(x.name.toLowerCase())) addSize(x, `${mx[1]} x ${mx[2]} ${mx[3]}`);
    else if (w && !/\d\s*(lb|kg|g|ml|l)\b/.test(x.name.toLowerCase())) addSize(x, `${w[1]} ${w[2]}`);
    return x;
  }
  async function addDetails(out, opts) {
    // no size in the name: the item's own page usually has it ("200-235 g"); taxes / "each" after the price do not count
    const noSizeTxt = (p) => !p || /^\s*(ch\.?|chacun\w*|l.un\.?|\+?\s*tx|taxable|\+?\s*tax\w*|\s)*\s*$/i.test(p);
    const todo = out.filter((x) => !x.det && (noSizeTxt(x.post) || String(x.ing || "").startsWith("k_")) && !/\d\s*(lb|kg|g|ml|l|un\.?)\b/i.test(x.name) && x.fid).slice(0, opts.maxDetails || 320);
    let i = 0;
    const worker = async () => { while (i < todo.length) { const x = todo[i++]; const d = await detailOf(x.fid, opts.fetch); if (d.trim()) { applyDetail(x, d); x.det = 1; } } };
    if (opts.pause) { // slow and polite: one page at a time (a page already read is not asked again)
      for (const x of todo) { const seen = DETAIL.has(x.fid), d = await detailOf(x.fid, opts.fetch); if (d.trim()) { applyDetail(x, d); x.det = 1; } if (!seen) await new Promise((res) => setTimeout(res, opts.pause)); }
      return;
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  }

  // Price -> what it buys, without AI. Returns {qte, unite} or null when the size is unknown.
  // usual count in one package, for "unit" ingredients sold in packs (used only when the AI can't tell)
  const PACK = { clementine: 12, poire: 6, orange: 8, oeufs: 12, pain_tranche: 20, kaiser: 6, bagel: 6, tortilla: 10, pita: 6, croissant: 6, ciabatta: 4, pain_sousmarin: 6, pain_hotdog: 8, pain_burger: 8, fromage_tranche: 16, ail: 10 };
  const NUM = (s) => Number(String(s).replace(",", "."));
  // about how many per pound, for fruits and vegetables counted by the unit
  // the most one fruit or vegetable costs, even on special
  const MAXEACH = { oignon: 1.5, orange: 2, pomme: 2, poire: 2, clementine: 1, citron: 1.5, lime: 1, tomate: 2.5, concombre: 3.5, poivron: 3.5, avocat: 3.5, courgette: 3, poireau: 3, laitue: 5, brocoli: 5, chou_fleur: 6 };
  const EACH_LB = { ail: 90, orange: 2, pomme: 3, poire: 2.5, clementine: 6, citron: 4, lime: 7, concombre: 1.5, poivron: 2.5, oignon: 3, tomate: 3, avocat: 2.5, courgette: 2, aubergine: 1, brocoli: 1.5, chou_fleur: 0.5, laitue: 1, poireau: 2.5 };
  function sizeOf(r, ingU) {
    const post = norm(r.post), nm = norm(r.name);
    const pm = String(r.pre || "").match(/^\s*(\d+)\s*(?:\/|pour\b)/i);
    const mult = pm ? Number(pm[1]) : 1;
    let m = String(r.post).toLowerCase().match(/^\s*(?:\/|le|la|par)?\s*100\s*g/);
    if (m) return { qte: 100, unite: "g" }; // "/100g prix membre 14,47/kg": the price is for 100 g
    const pst = String(r.post).trim().toLowerCase();
    if (/^\/?\s*lb\b/.test(pst) || (/(^| )lb( |$)/.test(post) && !/\/\s*kg/.test(pst))) return { qte: 1 * mult, unite: "lb" };
    if (/^\/?\s*kg\b/.test(pst) || /(^| )kg( |$)/.test(post) && !/\d\s*\/\s*kg/.test(pst)) return { qte: 1 * mult, unite: "kg" };
    const raw = String(r.name).toLowerCase().replace(/œ/g, "oe");
    // several products in one name ("carottes 5 lb, betteraves 5 lb et panais 1 lb"): the size written right after our product
    const key = T[r.ing] && T[r.ing][1].map((x) => String(x).split("|")[0].replace(/^=/, "")).sort((x, y) => y.length - x.length)[0];
    const own = key && raw.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-zàâçéèêëîïôûù]*\\s+(\\d+(?:[.,]\\d+)?)\\s*(kg|g|ml|l|lb)\\b"));
    const many = (raw.match(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|lb)\b/g) || []).length > 1;
    m = raw.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lb)\b/);
    let q = null;
    const firstSize = raw.search(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|lb)\b/);
    const keyAt = key ? raw.search(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) : -1;
    if (!own && firstSize >= 0 && keyAt > firstSize && / ou |, /.test(raw.slice(firstSize, keyAt))) return null; // "saucisson 375 g ou cheddar": 375 g is not the cheddar
    if (own && many) q = { qte: NUM(own[1]), unite: own[2] };
    else if (m) q = { qte: Number(m[1]) * NUM(m[2]), unite: m[3] };
    else if ((m = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|lb)\b/))) q = { qte: NUM(m[1]), unite: m[2] };
    const xMul = /\d+\s*[x×]\s*\d/.test(raw);
    if (q && !xMul) { const pk = raw.match(/(?:paquet|paq\.?|caisse|emballage|boite|bo[iî]te)\s*de\s*(\d+)(?!\s*(?:g|kg|ml|l|lb)\b)/); if (pk && Number(pk[1]) > 1 && Number(pk[1]) <= 48 && /^(ml|l)$/.test(q.unite) && q.qte <= 750) q.qte *= Number(pk[1]); } // "355 ml paquet de 24"
    // a case of beer with only the can size written ("Bière ... 355 ml" at 36,74 $): about 24 cans (a guess: no price note)
    if (q && !xMul && /^(k_biere|biere)$/.test(r.ing) && q.qte <= 500 && q.unite === "ml" && r.prix / mult >= 12 && !/(paquet|paq|caisse|emballage|boite)\s*de/.test(raw)) { q.qte *= r.prix / mult >= 25 ? 24 : 12; q.g = 1; }
    if (q) { if (q.unite === "l") q.unite = "L"; q.qte *= mult; }
    if (!q && ingU === "ml" && r.ing === "lait" && !/(^| )(ml|l|litre)( |$)/.test(nm)) return { qte: 2000 * mult, unite: "ml" }; // milk without a size: the usual 2 L
    if (ingU === "u") {
      if (q && EACH_LB[r.ing] && ["lb", "kg", "g"].includes(q.unite)) return q.unite === "g" ? { qte: q.qte / 453.6, unite: "lb" } : q; // bag sold by weight
      if (/douzaine/.test(nm)) return { qte: 12 * mult, unite: "u" };
      m = raw.match(/\b(\d+)\s*\/\s*(\d+(?:[.,]\d+)?)\s*\$/); // "Citrons 5/2$" = 5 for the price
      if (m && Math.abs(NUM(m[2]) - Number(r.prix)) < 0.02) return { qte: Number(m[1]), unite: "u" };
      m = raw.match(/(?:paq(?:uet)?\.?\s*de|pqt\s*de|sac\s*de|boite\s*de|caisse\s*de|emballage\s*de)\s*(\d+)(?!\s*(?:g|kg|ml|l|lb)\b)/) || raw.match(/\b(\d+)\s*(?:un\b|unités?\b|unites?\b|pains\b|bagels\b|tortillas\b|croissants\b|pitas\b|oeufs\b|œufs\b)/);
      if (m) return { qte: Number(m[1]) * mult, unite: "u" };
      m = String(r.post).toLowerCase().match(/ou\s*(\d+[.,]\d{2})\s*\$\s*(?:l'|l’)?unit/); // "4,99 $ ou 0,50 $ l'unité": the bag holds about 10
      if (m && NUM(m[1]) > 0 && r.prix > NUM(m[1])) return { qte: Math.round(r.prix / NUM(m[1])), unite: "u" };
      if (/(^| )(ch|chacun|chacune|unite|l unite|un)( |$)/.test(post)) return PACK[r.ing] && /(^| )(unite|l unite)( |$)/.test(post) ? { qte: mult * PACK[r.ing], unite: "u", g: 1 } : { qte: 1 * mult, unite: "u" }; // "Pains kaiser 2/10 $ ... l'unité": 2 bags, not 2 rolls
      return null; // count not written (bag, pack, by weight): the AI reads it

    }
    return q;
  }
  // Raw flyer items -> app specials {ing, mag, prix, qte, unite, txt}; the ones with an unknown size are returned apart
  function toItems(raw, ING, opts) {
    opts = opts || {};
    const items = [], unknown = [];
    for (let r of raw) {
      const ing = ING[r.ing]; if (!ing) continue;
      // "169" with no decimals for 400 g of pasta: the flyer gave cents (1,69 $)
      if (Number.isInteger(Number(r.prix)) && r.prix >= 100 && r.mag !== "Costco") r = Object.assign({}, r, { prix: r.prix / 100 });
      const fix = opts.sizes && opts.sizes[r.ing + "|" + r.name];
      if (fix && fix.skip) continue;
      const perU = ing.u === "u" && String(ing.n || "").match(/\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i);
      let s = sizeOf(r, ing.u) || (perU ? sizeOf(r, perU[2].toLowerCase() === "ml" ? "ml" : "g") : null) || (fix && fix.qte ? fix : null);
      let guessed = !!(s && fix && s === fix && fix.guess) || !!(s && s.g);
      if (!s && opts.guess && ing.u === "u" && PACK[r.ing] && !sizeOf(r, "g")) { s = { qte: PACK[r.ing], unite: "u" }; guessed = true; }
      if (!s) { unknown.push(r); continue; }
      const shown = ing.u === "u" && ["lb", "kg", "g", "ml", "L"].includes(s.unite) ? String(Math.round(s.qte * 100) / 100).replace(".", ",") + " " + s.unite : ""; // "5 lb" bag, shown as such
      if (ing.u === "u" && (s.unite === "lb" || s.unite === "kg") && EACH_LB[r.ing]) s = { qte: Math.max(1, Math.round(s.qte * (s.unite === "kg" ? 2.2046 : 1) * EACH_LB[r.ing])), unite: "u" };
      // sold by the unit of a known size ("Tofu ferme (454 g)", "Thon (170 g)"): a 1,25 kg pack = 2.75 units
      const per = ing.u === "u" && String(ing.n || "").match(/\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i);
      if (per && ["g", "kg", "lb", "ml", "L"].includes(s.unite)) {
        const amt = s.unite === "kg" ? s.qte * 1000 : s.unite === "lb" ? s.qte * 453.6 : s.unite === "L" ? s.qte * 1000 : s.qte;
        const u1 = Number(per[1].replace(",", "."));
        if (u1 > 0 && amt / u1 >= 0.5 && amt / u1 <= 24) s = { qte: Math.round((amt / u1) * 100) / 100, unite: "u" };
      }
      if (ing.u === "u" && s.unite !== "u") { unknown.push(r); continue; }
      if (ing.u === "u" && MAXEACH[r.ing] && r.prix / s.qte > MAXEACH[r.ing]) { unknown.push(r); continue; } // "3,99 $ ch." for one onion: it is a bag
      if (ing.u === "g" && !["lb", "kg", "g"].includes(s.unite)) { unknown.push(r); continue; }
      if (ing.u === "ml" && !["L", "ml"].includes(s.unite)) { unknown.push(r); continue; }
      if (["cs", "ct"].includes(ing.u)) { unknown.push(r); continue; }
      items.push({ ing: r.ing, mag: r.mag, prix: r.prix, qte: s.qte, unite: s.unite, txt: (pretty(r.name).slice(0, 90) + (/membre/i.test(r.pre || "") ? " (prix membre)" : "")).trim(), img: r.img || "", reg: r.orig > r.prix ? r.orig : 0, story: r.story || "", pack: shown && s.unite === "u" ? shown : "", ...(guessed ? { guess: true } : {}) });
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

  const api = { STORES, REGIONS, distKm, nearestRegion, TERMS: T, norm, matches, search, collect, sizeOf, toItems, pretty, bestPerStore, LB, applyDetail, excluded, addDetails, PACK };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Flipp = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
