import express, { Request, Response } from 'express';
import db from './models';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with Sequelize and TypeScript!');
});

app.use(routes);


const startServer = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Database connected!');
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
