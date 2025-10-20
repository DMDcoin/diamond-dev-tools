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
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Database connection failed - some endpoints may not work:', errorMessage);
    } finally {
        // Start server regardless of database connection status
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }
};

startServer();
