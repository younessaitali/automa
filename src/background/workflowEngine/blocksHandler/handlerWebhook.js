import objectPath from 'object-path';
import { isWhitespace } from '@/utils/helper';
import { executeWebhook } from '@/utils/webhookUtil';
import { getBlockConnection } from '../helper';

export async function webhook({ data, outputs }) {
  const nextBlockId = getBlockConnection({ outputs });
  const fallbackOutput = getBlockConnection({ outputs }, 2);

  try {
    if (isWhitespace(data.url)) throw new Error('url-empty');
    if (!data.url.startsWith('http')) throw new Error('invalid-url');

    const response = await executeWebhook(data);

    if (!response.ok) {
      if (fallbackOutput.connections.length > 0) {
        return {
          data: '',
          nextBlockId: fallbackOutput,
        };
      }

      throw new Error(`(${response.status}) ${response.statusText}`);
    }

    if (!data.assignVariable && !data.saveData) {
      return {
        data: '',
        nextBlockId,
      };
    }

    let returnData = '';

    if (data.responseType === 'json') {
      const jsonRes = await response.json();

      returnData = objectPath.get(jsonRes, data.dataPath);
    } else {
      returnData = await response.text();
    }

    if (data.assignVariable) {
      this.setVariable(data.variableName, returnData);
    }
    if (data.saveData) {
      if (data.dataColumn === '$assignColumns' && Array.isArray(returnData)) {
        this.addDataToColumn(returnData);
      } else {
        this.addDataToColumn(data.dataColumn, returnData);
      }
    }

    return {
      nextBlockId,
      data: returnData,
    };
  } catch (error) {
    if (fallbackOutput && error.message === 'Failed to fetch') {
      return {
        data: '',
        nextBlockId: fallbackOutput,
      };
    }

    error.nextBlockId = nextBlockId;

    throw error;
  }
}

export default webhook;
