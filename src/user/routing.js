const connect = require('../../lib/database.js');
const dao = require('./dao.js');

module.exports = router => {

	router.post('/user/add', req => {
		let conn;
		let user = {...req.body};
		connect()
			.then(res => dao.add(conn = res, user))
			.then(id => {
				conn.end();
				req.json(id);
			})
			.catch(error => {
				if (conn) conn.end();
				req.error(500, error);
			});
	});

	router.get('/user/list', req => {
		let conn;
		connect()
			.then(res => dao.list(conn = res))
			.then(array => {
				conn.end();
				req.json(array);
			})
			.catch(error => {
				if (conn) conn.end();
				req.error(500, error);
			});
	});

};