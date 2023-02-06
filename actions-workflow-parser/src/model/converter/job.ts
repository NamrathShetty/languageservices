import {TemplateContext} from "../../templates/template-context";
import {StringToken, MappingToken, BasicExpressionToken, TemplateToken, ScalarToken} from "../../templates/tokens";
import {isSequence, isString} from "../../templates/tokens/type-guards";
import {WorkflowJob, Step} from "../workflow-template";
import {convertConcurrency} from "./concurrency";
import {convertToJobContainer, convertToJobServices} from "./container";
import {handleTemplateTokenErrors} from "./handle-errors";
import {IdBuilder} from "./id-builder";
import {convertToActionsEnvironmentRef} from "./job/environment";
import {convertRunsOn} from "./job/runs-on";
import {convertSteps} from "./steps";

export function convertJob(context: TemplateContext, jobKey: StringToken, token: MappingToken): WorkflowJob {
  const error = new IdBuilder().tryAddKnownId(jobKey.value);
  if (error) {
    context.error(jobKey, error);
  }

  let concurrency, container, env, environment, name, outputs, runsOn, services, strategy: TemplateToken | undefined;
  let needs: StringToken[] | undefined = undefined;
  let steps: Step[] = [];
  let workflowJobRef: StringToken | undefined;

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "concurrency":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertConcurrency(context, item.value));
        concurrency = item.value;
        break;

      case "container":
        convertToJobContainer(context, item.value);
        container = item.value;
        break;

      case "env":
        env = item.value.assertMapping("job env");
        break;

      case "environment":
        handleTemplateTokenErrors(item.value, context, undefined, () =>
          convertToActionsEnvironmentRef(context, item.value)
        );
        environment = item.value;
        break;

      case "name":
        name = item.value.assertScalar("job name");
        break;

      case "needs": {
        needs = [];
        if (isString(item.value)) {
          const jobNeeds = item.value.assertString("job needs id");
          needs.push(jobNeeds);
        }

        if (isSequence(item.value)) {
          for (const seqItem of item.value) {
            const jobNeeds = seqItem.assertString("job needs id");
            needs.push(jobNeeds);
          }
        }
        break;
      }

      case "outputs":
        outputs = item.value.assertMapping("job outputs");
        break;

      case "runs-on":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertRunsOn(context, item.value));
        runsOn = item.value;
        break;

      case "services":
        convertToJobServices(context, item.value);
        services = item.value;
        break;

      case "steps":
        steps = convertSteps(context, item.value);
        break;

      case "strategy":
        strategy = item.value;
        break;

      case "uses":
        workflowJobRef = item.value.assertString("job item uses");
        break;
    }
  }

  if (workflowJobRef !== undefined) {
    return {
      type: "reusableWorkflowJob",
      id: jobKey,
      name: jobName(name, jobKey),
      needs: needs ?? [],
      if: new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      ref: workflowJobRef,
      concurrency,
      strategy
    };
  } else {
    return {
      type: "job",
      id: jobKey,
      name: jobName(name, jobKey),
      needs,
      if: new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      env,
      concurrency,
      environment,
      strategy,
      "runs-on": runsOn,
      container,
      services,
      outputs,
      steps
    };
  }
}

function jobName(name: ScalarToken | undefined, jobKey: StringToken): ScalarToken {
  if (name === undefined) {
    return jobKey;
  }

  if (isString(name) && name.value === "") {
    return jobKey;
  }

  return name;
}
