import sequelize, { Sequelize } from 'sequelize';
import {initModels} from "./init-models";

export type DB = {
    sequelize: Sequelize,
    Sequelize: any,
}
const seq = new Sequelize('postgres', 'postgres', process.env.POSTGRES_PASSWORD, {
        host: 'db',
        dialect: 'postgres', // or 'mysql', 'sqlite', etc.
    });
const db: DB = {
    sequelize: seq,
    Sequelize: sequelize,
};
initModels(seq);


export default db;
