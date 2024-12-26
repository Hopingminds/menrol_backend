const allowedOrigins = [
	'*',
	'http://localhost:3000',
	'http://localhost:3022',
	'http://localhost:5173',
	'https://menrol-admin.vercel.app',
	'https://www.menrol.com',
	'https://menrol.com'
];

const corsOptions = {
	origin: (origin, callback) => {
		if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS origin'));
		}
	},
	credentials: true,
	optionsSuccessStatus: 200
};

export default corsOptions;
