import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import openapiDocument from '../openapi.json';

const router = Router();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openapiDocument));

export default router;
