const fs = require('fs');
const url = require('url');
const http = require('http');
const mime_types = require('mime-types');
const routs = {};
const JSON_MIME = mime_types.lookup('.json');
const TEXT_MIME = mime_types.lookup('.txt');
const port = 80;
const web_root = __dirname + '/web';

// Conteúdo do arquivo virtual '/js/import-forms.js'
let import_script = '';

// Testa se o caminho é de um arquivo javascript
const isScriptFile = path => {
	const i = path.lastIndexOf('.');
	if (i === -1) return false;
	return path.substr(i + 1).toLowerCase() === 'js';
};

// Busca recursivamente todos os arquivos de script na pasta 'forms/' e preenche o conteúdo do
// arquivo virtual '/js/import-forms.js' com a importação de cada script encontrado
const createImportScript = () => {

	// Caminho absoluto da raíz da busca
	const root = web_root + '/forms';
	
	// Conteúdo do arquivo de importação
	import_script = '';

	// Verifica se o arquivp é um arquivo de script, se for adiciona sua importação no script de
	// importações
	const checkFile = path => {
		if (isScriptFile(root + path)) {
			import_script += `import '/forms${ path }';\n`;
		}
	};

	// Explora recursivamente um diretório
	const exploreDir = path => {
		fs.readdirSync(root + path).forEach(fname => {
			const new_path = `${ path }/${ fname }`;
			if (fs.lstatSync(root + new_path).isDirectory()) {
				exploreDir(new_path);
			} else {
				checkFile(new_path);
			}
		});
	};

	// Começa exporando a raiz
	exploreDir('');
};

class Request {

	constructor(req, res) {
		
		this.req = req;
		this.res = res;

		// Faz o parse da URL e salva o caminho e a query
		const {pathname, query} = url.parse(req.url, true);
		this.path = pathname;
		this.query = query;

	}

	// Envia um elemento como resposta utilizando JSON
	json(arg) {
		const {res} = this;
		res.writeHead(200, {'Content-Type': JSON_MIME});
		res.end(JSON.stringify(arg));
		return this;
	}

	// Envia um erro como resposta
	// Code: código do erro
	// Error: erro, se for um valor não nulo é impresso no console
	error(code, error) {
		const {res} = this;
		if (error) console.error(error);
		res.statusCode = code;
		res.end();
		return this;
	}

	// Envia um conteúdo como se fosse um arquivo
	sendAsFile(content, filename) {
		const {res} = this;
		res.writeHead(200, {
			'Content-Type': filename? mime_types.lookup(filename): TEXT_MIME
		});
		res.end(content);
	}

	// Carrega o conteúdo do body, faz o parser e chama o callback quando pronto
	loadBody(callback) {
		const {req} = this;
		const chunks = [];
		req.on('data', chunk => chunks.push(chunk));
		req.on('end', () => {
			let str = Buffer.concat(chunks).toString('utf8');
			const {query} = url.parse('?' + str, true);
			this.body = query;
			callback();
		});
	}
}

class Router {
	constructor() {
		// Mapas de rotas
		this.routs = {
			GET: {},
			POST: {}
		};
	}

	// Adiciona uma rota get
	get(path, handler) {
		const {routs} = this;
		routs['GET'][path] = handler;
		return this;
	}

	// Adiciona uma rota post
	post(path, handler) {
		const {routs} = this;
		routs['POST'][path] = handler;
		return this;
	}

	// Tenta chamar uma rota
	// Retorna um booleano indicando se a rota existe
	call(method, path, request) {
		const {routs} = this;
		const handler = routs[method][path];

		// Rota não existe
		if (!handler) return false;

		try {
			// Se o método for POST carrega o body antes de executar a rota
			if (method === 'POST') {
				request.loadBody(() => {
					handler(request);
				});
			} else {
				handler(request);
			}
		} catch(error) {
			// Se houver erro de execução na execução da rota erro interno é enviado
			request.error(500, error);
		}
		return true;
	}

	// Limpa todas as rotas criadas
	clear() {
		const {routs} = this;
		routs.GET = {};
		routs.POST = {};
		return this;
	}
}

const router = new Router();
const server = http.createServer((req, res) => {
	
	const request = new Request(req, res);
	let {path} = request;

	// Retorna o arquivo de importação
	if (path === '/js/import-forms.js') {
		createImportScript();
		request.sendAsFile(import_script, '.js');
		return;
	}
	
	if (router.call(req.method, path, request)) return;

	// Caminho completo do arquivo
	path = web_root + path;

	// Arquivo inexistente
	if (!fs.existsSync(path)) {
		request.error(404);
		return;
	}

	// Se arquivo for uma pasta tenta acessar um index.html dentro da pasta
	if (fs.lstatSync(path).isDirectory()) {
		path += 'index.html';

		// Pasta não possui um index.html
		if (!fs.existsSync(path)) {
			request.error(404);
			return;
		}
	}

	let file;
	try {
		// Tenta carregar o arquivo
		file = fs.readFileSync(path);
	} catch (error) {
		// Erro ao carregar arquivo
		request.error(500, error);
		return;
	}

	// Seta status como 200 (ok), seta tipo 'MIME' do conteúdo
	res.writeHead(200, {'Content-Type': mime_types.lookup(path)});

	// Envia o arquivo
	res.end(file);

});

const loadRouts = () => {
	const exploreDir = path => {
		let routing_path = path + '/routing.js';
		if (fs.existsSync(routing_path)) {
			const routing = require(routing_path);
			routing(router);
		}
		fs.readdirSync(path).forEach(fname => {
			const new_path = `${ path }/${ fname }`;
			if (fs.lstatSync(new_path).isDirectory()) {
				exploreDir(new_path);
			}
		});
	};
	exploreDir('./src');
};

loadRouts();

server.listen(port, () => {
	console.log('Server listening at port ' + port);
});