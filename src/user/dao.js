module.exports.add = (conn, user) => new Promise((done, fail) => {
	const {name, password} = user;
	conn.query('INSERT INTO User (name, password) VALUES (?, ?)', [name, password])
		.then(res => done(res.insertId || null))
		.catch(fail);
});

module.exports.list = conn => conn.query('SELECT * FROM mydb.User;');