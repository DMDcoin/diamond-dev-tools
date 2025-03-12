import {validationResult} from 'express-validator';

class Params {
    public static validate(req:any, res:any, next:any):any {
        try {
            validationResult(req).throw();
            next();
        } catch (err) {
            return res.status(403).send({ message: "wrong-parameters" });
        }
    }
}

export default Params;
