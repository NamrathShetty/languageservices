import {parseActionReference} from "@github/actions-languageservice/action";
import {isString} from "@github/actions-workflow-parser";
import {isActionStep} from "@github/actions-workflow-parser/model/type-guards";
import {Step} from "@github/actions-workflow-parser/model/workflow-template";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata";
import {TTLCache} from "../utils/cache";

export async function getActionInputDescription(
  client: Octokit,
  cache: TTLCache,
  step: Step,
  token: TemplateToken
): Promise<string | undefined> {
  if (!isActionStep(step)) {
    return undefined;
  }
  const action = parseActionReference(step.uses.value);
  if (!action) {
    return undefined;
  }

  const inputName = isString(token) && token.value;
  if (!inputName) {
    return undefined;
  }

  const metadata = await fetchActionMetadata(client, cache, action);
  if (!metadata?.inputs) {
    return undefined;
  }

  return metadata.inputs[inputName]?.description;
}
