// http://localhost:6777/

const cookieParser=require('cookie-parser');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser') 
const app = express();
const port = 6777;
const fs=require('fs');

const blockedUsers = {};
const blockedIPs = {};
const blockDuration = 1000 * 60; // durata de blocare - 30 secunde
const maxAttempts = 3; // nr max de incercari permise pt o resursa inexistenta

const failedLoginAttempts = {
	ip: {},
	username: {},
  };

const MAX_FAILED_ATTEMPTS = 3;
const BLOCK_DURATION = 30 * 1000; // 30 secunde
var session = require('express-session');

app.use(session({
	secret:'secret',
	resave:false,
	saveUninitialized: false,
	cookie:{
	maxAge:null
}}));

app.use(cookieParser()); 

// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res


app.get('/', (req, res) => {
	//res.render('index');

	// stergem datele memorate
	res.clearCookie('mesajEroare');
	res.clearCookie('produse');

	var produse = null;
	if(req.cookies['produse'] != null){
		produse = req.cookies['produse'];
	}
	if(req.cookies["utilizator"]){
		res.render('index', {utilizator: req.cookies["utilizator"],	produse: produse});
	}
	else
	{
		res.render('index', {utilizator: undefined,	produse: produse});
	}
});

// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
app.get('/chestionar', (req, res) => { 
    fs.readFile("intrebari.json",(err,data)=>{
		if(err)
		{
			console.log(err);
		}
		const listaIntrebari = JSON.parse(data);
     
        //res.render('chestionar', {intrebari: listaIntrebari});
		
		let utilizator = req.session.numeLogat;
		res.render('chestionar', {intrebari: listaIntrebari, utilizator:utilizator});
 })
});

app.post('/rezultat-chestionar', (req, res) => { 
	var raspunsuriInput =req.body;
	console.log(raspunsuriInput);
	var count=0;
	fs.readFile("intrebari.json",(err,data)=>{
		if(err)
		{
			console.log(err);
		}
		const listaIntrebari = JSON.parse(data);
		for(var i=0;i<listaIntrebari.length;i++)
		{
			if(raspunsuriInput["q"+i] === listaIntrebari[i].variante[listaIntrebari[i].corect])
			{
				count+=1;
			}
		}
		//res.render('rezultat-chestionar',{raspuns:count});
		let utilizator = req.session.numeLogat;
		res.render('rezultat-chestionar', { raspuns:count, utilizator: utilizator});
	});
});

app.get('/autentificare',(req,res)=>{
	//Obtinere mesaj de eroare din cookie, daca exista
	//const mesajEroare = req.cookies.mesajEroare || '';
	//Sterge cookie-ul pentru mesajul de eroare
	//res.clearCookie('mesajEroare');
	 
	res.render('autentificare',{mesajEroare: req.cookies.mesajEroare, utilizator: null});
});	

app.post('/verificare-autentificare', (req, res) => {
	/*
	var username = req.body.username;
	var password = req.body.password;

	if (username === 'Elena' && password === 'Elena'){ 
		// setează cookie-ul cu numele utilizator
		res.cookie('utilizator', username);
		// trimite un răspuns de redirect
		res.redirect('http://localhost:6777/');
    } else {
		// seteaza cookie-ul cu mesajul de eroare
    	res.cookie('mesajEroare', 'Utilizator sau parolă greșită!');
		res.redirect('http://localhost:6777/autentificare');
    }*/


	fs.readFile('utilizatori.json', (err, data) => {
		if (err) throw err;
		console.log("Verificare Autentificare");
		console.log(req.body);

		var users = JSON.parse(data);
		var i = 0;
		let ok = 0;

		for (i in users.utilizatori) {
		  if (req.body.numeUser === users.utilizatori[i].utilizator && req.body.numeParola === users.utilizatori[i].parola) {
			console.log("Am intrat in verificare");
			// Salvez în variabila de sesiune datele utilizatorului
			req.session.nume = users.utilizatori[i].nume;
			req.session.prenume = users.utilizatori[i].prenume;
			req.session.rol = users.utilizatori[i].rol;
			console.log("ROL: " + req.session.rol);
			ok = 1;
		  }
		}

		//Verificare nr de incercari nereusite pt adresa IP
		const adresaIP = req.ip;
		if (!failedLoginAttempts.ip[adresaIP]) {
		  failedLoginAttempts.ip[adresaIP] = 1;
		} else {
		  failedLoginAttempts.ip[adresaIP]++;
		}

		//Verificare nr de incercari nereusite pt user
		const numeUtilizator = req.body.numeUser;
		if (!failedLoginAttempts.username[numeUtilizator]) {
		  failedLoginAttempts.username[numeUtilizator] = 1;
		} else {
		  failedLoginAttempts.username[numeUtilizator]++;
		}

		//Verificare daca adresa IP sau user ul trebuie blocate
		if (
		  failedLoginAttempts.ip[adresaIP] >= MAX_FAILED_ATTEMPTS ||
		  failedLoginAttempts.username[numeUtilizator] >= MAX_FAILED_ATTEMPTS
		) {
		  blockedUsers[adresaIP] = true;
		  blockedUsers[numeUtilizator] = true;

		  setTimeout(() => {
			console.log("S-a terminat timpul de asteptare.");
			blockedUsers[adresaIP] = false;
			blockedUsers[numeUtilizator] = false;
			failedLoginAttempts.ip[adresaIP] = 0;
			failedLoginAttempts.username[numeUtilizator] = 0;
		  }, BLOCK_DURATION);

		  res.cookie('mesajEroare', 'Accesul este blocat. Vă rugăm să încercați din nou mai târziu.');
		  res.clearCookie('utilizator');
		  res.redirect('/autentificare');
		} else if (ok == 0) {
		  console.log("Numele utilizatorului sau parola sunt greșite!");

		  res.cookie('mesajEroare', 'Numele utilizatorului sau parola sunt greșite!', { maxAge: 1 * 60000 });
		  res.clearCookie('utilizator');
		  res.redirect('/autentificare');
		} else {
		  console.log("Autentificare corectă!");
		  req.session.numeLogat = req.body.numeUser;
		  console.log(req.session.numeLogat);
		  res.cookie('utilizator', req.body.numeUser, { maxAge: 600000 });
		  res.redirect("/");
		}
	  });
});

app.get('/logout',(req,res)=>{
	res.clearCookie('utilizator');
	req.session.destroy();
    res.redirect('/');
});

app.get('/creare-bd', (req, res)=>{
	// Conectarea la baza de date in-memory 
	const sqlite3 = require('sqlite3').verbose();
	// Creare obj Database     https://www.sqlitetutorial.net/sqlite-nodejs/connect/
	let db = new sqlite3.Database('cumparaturi.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
		  return console.error(err.message);
		}
		console.log('Connected to the in-memory SQlite database.');
		/*db.run(
			'DROP TABLE produse');*/
		db.run(
			'CREATE TABLE IF NOT EXISTS produse (id INTEGER PRIMARY KEY AUTOINCREMENT, nume TEXT, pret TEXT)',
			(err) => {
			  if (err) {
				console.error('Eroare la crearea tabelului:', err);
				return res.status(500).send('Internal Server Error');
			  }
			})
	});


	db.close((err) => {
		if (err) {
			return console.error(err.message);
		}
		console.log('Close the database connection.');
	});


	let utilizator = req.session.numeLogat;
	res.redirect("/");
});

app.get('/inserare-bd', (req, res)=>{
	const sqlite3 = require('sqlite3').verbose();
	const db = new sqlite3.Database('cumparaturi.db');

	// Stergere toate produsele din tabela produse
    db.run('DELETE FROM produse', (err) => {
        if (err) {
            console.error('Eroare la stergerea produselor:', err);
            return res.status(500).send('Internal Server Error');
        }
	});

	// Resetare auto-increment
	db.run('DELETE FROM sqlite_sequence WHERE name = "produse"', (err) => {
		if (err) {
			console.error('Eroare la resetarea auto-increment-ului:', err);
			return res.status(500).send('Internal Server Error');
		}
	});

	// Inserare produse in tabela produse
	const produse = [
		{ nume: 'Cutie cu 5 trandafiri roz, criogenati', pret: '320 lei' },
		{ nume: 'Trandafir criogenat rosu, in cupola', pret: '269 lei' },
		{ nume: 'Buchet de 19 trandafiri rosii', pret: '349 lei' },
		{ nume: 'Coronita de flori', pret: '159 lei'},
		{ nume: 'Buchet cu crizanteme si trandafiri', pret: '300 lei' },
		{ nume: 'Coroana funerara cu crizantema mov', pret: '450 lei' },
		{ nume: 'Aranjament funerar cu garbera si trandafiri', pret: '385 lei' },
		{ nume: 'Buchet de flori - Vise colorate', pret: '315 lei' },
		{ nume: 'Buchet mixt cu orhidee', pret: '299 lei' },
		{ nume: 'Buchet cu orhidee cymbidium', pret: '145 lei' },
	  ];
	
	  db.serialize(() => {
		db.run('BEGIN TRANSACTION');
			 
		const stmt = db.prepare('INSERT INTO produse (nume, pret) VALUES (?, ?)');
		produse.forEach((produs) => {
		  stmt.run(produs.nume, produs.pret);
		  // console.log("A fost inserat produsul " + produs.nume);
		});
		stmt.finalize();
	
		db.run('COMMIT', (err) => {
		  if (err) {
			console.error('Eroare la inserarea produselor:', err);
			return res.status(500).send('Internal Server Error');
		}});
	
		db.close();

		res.redirect('/');
	});
});

app.get('/afisare-bd', (req, res)=>{

	const sqlite3 = require('sqlite3').verbose();
	const db = new sqlite3.Database('cumparaturi.db');

	db.all('SELECT * FROM produse', (err, rows) => {
		if (err) {
			console.error('Eroare la selectarea produselor:', err);
			res.send('Nu exista baza de date!');
			return;
		}
	
		var result = rows.map((produs) => {
			return {
				nume: produs.nume,
				pret: produs.pret,
				id: produs.id
			};
		})
		console.log("Date extrase cu succes");
		res.cookie('produse', result);
		res.redirect('/');

		db.close();
	});
});

app.post('/adaugare-cos', (req, res) => {
	var idProdus = req.body.id;

	const sqlite3 = require('sqlite3').verbose();
	const db = new sqlite3.Database('cumparaturi.db');
  
	// Interogare pentru a selecta produsul după ID
	const query = 'SELECT * FROM produse WHERE id = ?';
	db.get(query, [idProdus], (err, row) => {
	  if (err) {
		console.error('Eroare la selectarea produsului:', err);
		return;
	  }

	  req.session.save((err) => {
		if (err) {
		  console.error('Eroare la salvarea sesiunii:', err);
		  return;
		}
	});
  
	  if (!req.session.produseInCos) {
		req.session.produseInCos = [];
	  }
  
	  req.session.produseInCos.push(row);
  
	  console.log('Produsul [' + row.nume + '] fost adăugat în coș');
  
	  db.close();
	  console.log('Produse în coș:', req.session.produseInCos);
	  console.log('-------');

	  res.redirect('/vizualizare-cos');
	});
});

app.get('/vizualizare-cos', (req, res) =>{
	let utilizator = req.session.numeLogat;
    res.render('vizualizare-cos', { produse: req.session.produseInCos, utilizator: utilizator });
});

app.get('/admin', (req, res) => {
	console.log(req.session.rol);
	if(req.session && req.session.rol === 'ADMIN')
	{
		res.render('admin', { utilizator: "ADMIN"});
	}
	else{
		res.send('Nu puteti accesa aceasta pagina!');
	}
});

app.post('/adaugare-produs', (req, res) => {

	  const { nume, pret } = req.body;
	  console.log(req.body);

	  const sqlite3 = require('sqlite3').verbose();
	  const db = new sqlite3.Database('cumparaturi.db');

	  const query = 'INSERT INTO produse (nume, pret) VALUES (?, ?)';

	  db.run(query, [nume, pret], function (err) {
		if (err) {
		  console.error('Eroare la inserarea produsului:', err);
		  res.sendStatus(500); // Raspuns cu eroare interna de server
		  return;
		}
  
		console.log('Produsul a fost adăugat cu succes:', this.lastID);
		db.close();
		//res.sendStatus(200); // Răspuns cu succes
		res.redirect('/afisare-bd');
	  });
  });
  
  // Adaugam utilizatorul in lista utilizatorilor blocati daca nu se gaseste o resursa
  app.use((req, res, next) => {
	console.log(req.cookies);
	const user = req.session.numeLogat;
	const ip = req.ip;
	console.log("user " + user);
	console.log("ip " + ip);
  
	// Verificam daca exista resursa
	const resource = req.path;
	const resourceExists =
	  resource === '/autentificare' ||
	  resource === '/chestionar' ||
	  resource === '/rezultat-chestionar' ||
	  resource === '/vizualizare-cos' ||
	  resource === '/' ||
	  resource === '/verificare-autentificare' ||
	  resource === '/logout' ||
	  resource === '/afisare-bd' ||
	  resource === '/adauare-cos' ||
	  resource === '/adauare-produs';
  
	if (!resourceExists) {
	  // Verificam numarul de incercari pentru utilizator
	  blockedUsers[user] = blockedUsers[user] || 0;
	  blockedUsers[user]++;
  
	  // Verificam daca numarul de incercari a fost depasit
	  if (blockedUsers[user] >= maxAttempts) {
		// Blocam utilizatorul pentru o perioada de timp
		blockedUsers[user] = true;
		setTimeout(() => {
		  delete blockedUsers[user];
		}, blockDuration);
	  }
  
	  // Blocheaza adresa IP
	  blockedIPs[ip] = blockedIPs[ip] || 0;
	  blockedIPs[ip]++;
  
	  // Verificam daca numarul de incercari pentru adresa IP a fost depasit
	  if (blockedIPs[ip] >= maxAttempts) {
		// Blocam adresa IP pentru o perioada de timp
		blockedIPs[ip] = true;
		setTimeout(() => {
		  delete blockedIPs[ip];
		}, blockDuration);
	  }
  
	  // Raspunde cu eroare
	  return res.status(404).send('Resursa nu există!!!');
	} else {
	  next(); // continuam procesarea cererii daca resursa exista
	}
  });
  
  // Adaugam o verificare inainte de tratarea cererilor
  app.use((req, res, next) => {
	console.log(blockedUsers);
	console.log(blockedIPs);
  
	const ip = req.headers['x-forwarded-for'] || req.remoteAddress;
	const user = req.session.numeLogat || ip;

	// Verificăm dacă utilizatorul sau adresa IP se află în lista celor blocate
	if (blockedUsers[user] || blockedIPs[ip]) {
		// Răspundem cu eroare și setăm un header pentru a indica că accesul este blocat
		res.status(403).header('X-Blocked-Access', 'true').send('Accesul blocat temporar. Vă rugăm să încercați mai târziu!');
	} else {
		next();
	}
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));