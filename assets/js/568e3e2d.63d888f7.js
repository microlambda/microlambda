"use strict";(self.webpackChunkmila_docs=self.webpackChunkmila_docs||[]).push([[942],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>m});var a=n(7294);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function s(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},o=Object.keys(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var l=a.createContext({}),c=function(e){var t=a.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):s(s({},t),e)),n},u=function(e){var t=c(e.components);return a.createElement(l.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},p=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,o=e.originalType,l=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),p=c(n),m=r,v=p["".concat(l,".").concat(m)]||p[m]||d[m]||o;return n?a.createElement(v,s(s({ref:t},u),{},{components:n})):a.createElement(v,s({ref:t},u))}));function m(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=n.length,s=new Array(o);s[0]=p;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i.mdxType="string"==typeof e?e:r,s[1]=i;for(var c=2;c<o;c++)s[c]=n[c];return a.createElement.apply(null,s)}return a.createElement.apply(null,n)}p.displayName="MDXCreateElement"},2996:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>s,default:()=>d,frontMatter:()=>o,metadata:()=>i,toc:()=>c});var a=n(7462),r=(n(7294),n(3905));const o={sidebar_position:7},s="Lambdas Environment Variables",i={unversionedId:"tutorial-basics/environment-variables",id:"tutorial-basics/environment-variables",title:"Lambdas Environment Variables",description:"Using dotenv",source:"@site/docs/1-tutorial-basics/7-environment-variables.md",sourceDirName:"1-tutorial-basics",slug:"/tutorial-basics/environment-variables",permalink:"/docs/tutorial-basics/environment-variables",draft:!1,tags:[],version:"current",sidebarPosition:7,frontMatter:{sidebar_position:7},sidebar:"tutorialSidebar",previous:{title:"Using middleware",permalink:"/docs/tutorial-basics/using-middleware"},next:{title:"Deploy your app",permalink:"/docs/category/deploy-your-app"}},l={},c=[{value:"Using dotenv",id:"using-dotenv",level:2},{value:"Injecting parameters from AWS SSM",id:"injecting-parameters-from-aws-ssm",level:3},{value:"Secrets and sensitive value",id:"secrets-and-sensitive-value",level:2},{value:"How to manage secrets ?",id:"how-to-manage-secrets-",level:3},{value:"The secrets already exists in AWS Secret Manager Vault",id:"the-secrets-already-exists-in-aws-secret-manager-vault",level:3},{value:"Manage secrets using Microlambda CLI",id:"manage-secrets-using-microlambda-cli",level:3},{value:"Create a new secret",id:"create-a-new-secret",level:4},{value:"Update secret value",id:"update-secret-value",level:4},{value:"Delete secret",id:"delete-secret",level:4},{value:"Pros and cons",id:"pros-and-cons",level:4},{value:"FAQ",id:"faq",level:3},{value:"How to grant Lambda execution role the permission to get secret value ?",id:"how-to-grant-lambda-execution-role-the-permission-to-get-secret-value-",level:4},{value:"How is the secret injected on runtime ?",id:"how-is-the-secret-injected-on-runtime-",level:4},{value:"Should I version my secrets ?",id:"should-i-version-my-secrets-",level:4}],u={toc:c};function d(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"lambdas-environment-variables"},"Lambdas Environment Variables"),(0,r.kt)("h2",{id:"using-dotenv"},"Using dotenv"),(0,r.kt)("p",null,"Microlambda provides a convenient way to deal with environment variables and secrets in a large scale project, with multiple environments and multiple services."),(0,r.kt)("p",null,"It removes duplication by allowing you to inject some variables for all services at all stages (dev, int, prod)."),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"And")," allows you to add/overwrite values per stage only at environment or service level."),(0,r.kt)("p",null,"You just need to define the variables in the correct dotenv file, according to the variables scope (global, only for a micro-service, an environment)."),(0,r.kt)("p",null,"Here is the dotenv files organization:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},"| envs/ # Contains the root environment, shared between services\n|--.env         # Env shared between services and stages\n|--.env.local   # Env shared between services for a given stage\n|--.env.dev\n|--.env.prod\n| services/\n|-- hello-world/\n|-- src/\n|-- envs/\n|---- .env           # Env only used for a service and all stages\n|---- .env.local     # Env only used for a service and a given env\n|---- .env.dev\n|---- .env.prod\n")),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"Just like dotenv, if the value already exists in your environment process when deploying or running in local, it will be used instead the one specified in dotenv file.")),(0,r.kt)("p",null,"When deploying or starting the project, the microlambda serverless plugin will automatically populate Lambda environment.\nYou do not need to maintain the environment section of serverless.yml anymore."),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"If a variable with the same key is defined in more than one dotenv file, the ",(0,r.kt)("strong",{parentName:"p"},"most specific take precedence"),".\nThe precedence order is the following (from least precise to most, the next value take precedence on previous): "),(0,r.kt)("ul",{parentName:"blockquote"},(0,r.kt)("li",{parentName:"ul"},"main dotenv in ",(0,r.kt)("inlineCode",{parentName:"li"},"env/.env")),(0,r.kt)("li",{parentName:"ul"},"main environment-specific dotenvs ",(0,r.kt)("inlineCode",{parentName:"li"},"env/.env.<env-name>")),(0,r.kt)("li",{parentName:"ul"},"service-specific dotenvs ",(0,r.kt)("inlineCode",{parentName:"li"},"services/<service-name>/envs/.env")),(0,r.kt)("li",{parentName:"ul"},"Environment-specific and service-specific dotenvs ",(0,r.kt)("inlineCode",{parentName:"li"},"services/<service-name>/envs/.env.<env-name>")))),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"This is a helper to define more conveniently environment variables scopes, but you still can use serverless.yml\nenvironment section if you want to.")),(0,r.kt)("h3",{id:"injecting-parameters-from-aws-ssm"},"Injecting parameters from AWS SSM"),(0,r.kt)("p",null,"You can use a special syntax to inject values from SSM in dotenv files."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},"MY_LOOSELY_COUPLED_PARAM=${ssm:my-secret-name:secret-version}\n")),(0,r.kt)("p",null,"This allows you to update the value for many services without redeploying which is a best practice for loosely coupled system."),(0,r.kt)("p",null,"Microlambda default middleware stack will interpolate the value on runtime in both local and deployed lambdas."),(0,r.kt)("h2",{id:"secrets-and-sensitive-value"},"Secrets and sensitive value"),(0,r.kt)("p",null,"Secrets should not be injected in Lambda environment variables."),(0,r.kt)("p",null,"Otherwise, anyone with ",(0,r.kt)("inlineCode",{parentName:"p"},"lambda:DescribeFunction")," IAM permission could read the secret value."),(0,r.kt)("p",null,"Best practice is to store secret value in a vault and inject the value in-memory of the lambda at runtime."),(0,r.kt)("p",null,"Microlambda provides helpers to achieve this very easily, in a way that both works in local run and on deployed\nfunctions."),(0,r.kt)("h3",{id:"how-to-manage-secrets-"},"How to manage secrets ?"),(0,r.kt)("p",null,"There are not perfect answer for this."),(0,r.kt)("p",null,"It depends to your project organization, processes and company culture."),(0,r.kt)("p",null,"There are usually two cases:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"You are not responsible for managing secret. Another team create them for you in AWS Secret Manager and gives you ARNs."),(0,r.kt)("li",{parentName:"ul"},"You are responsible for creating secrets.")),(0,r.kt)("p",null,"In the case you are responsible for creating secrets, many solutions can be considered:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"You may want to manage secrets with in a independent way (e.g. in other repository using Infrastructure as Code)."),(0,r.kt)("li",{parentName:"ul"},"You want store them as your CI/CD system repository secrets, so only a subset of your team can access them and their values can be used in CI/CD. Usually CI/CD system masks them from logs and sometime you can't consult them after creation. "),(0,r.kt)("li",{parentName:"ul"},"You do not want to store your secrets in your CI/CD system, but just in AWS Secret Manager. This way, they are stored in a unique place reducing risks of leaks. Fine-grained permission can be set for your team using IAM.")),(0,r.kt)("p",null,"According to te way you usually manage secrets in your project/company you should find the solution that fit your needs in\nthe three sections below."),(0,r.kt)("h3",{id:"the-secrets-already-exists-in-aws-secret-manager-vault"},"The secrets already exists in AWS Secret Manager Vault"),(0,r.kt)("p",null,"In your dotenv file, you just have to use this special syntax:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},"MY_SUPER_SECRET=${secrets:my-secret-name:secret-version}\n")),(0,r.kt)("p",null,"The microlambda framework will take care of everything, including:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Inject the secret ",(0,r.kt)("strong",{parentName:"li"},"value")," in the environment variable on local run"),(0,r.kt)("li",{parentName:"ul"},"Inject the secret ",(0,r.kt)("strong",{parentName:"li"},"ARN")," in deployed lambdas environment variables"),(0,r.kt)("li",{parentName:"ul"},"Grant deployed lambda IAM permission to decipher secret value"),(0,r.kt)("li",{parentName:"ul"},"Replace secret ARN with secret value in Lambda environment on runtime (in-memory, with a built-in ",(0,r.kt)("inlineCode",{parentName:"li"},"before")," middleware).")),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},(0,r.kt)("strong",{parentName:"p"},"Important:")," If you are using infrastructure replication capabilities, make sure your secret is available in every region you target environment is deployed on.")),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"Notice: For the local run, the ",(0,r.kt)("inlineCode",{parentName:"p"},"defaultRegion")," specified in your ",(0,r.kt)("inlineCode",{parentName:"p"},"mila.json")," configuration will be used as target region for AWS Secret Manager.")),(0,r.kt)("h3",{id:"manage-secrets-using-microlambda-cli"},"Manage secrets using Microlambda CLI"),(0,r.kt)("p",null,"If you do not want to store your secrets as repository variable, you can use the CLI to create secrets."),(0,r.kt)("h4",{id:"create-a-new-secret"},"Create a new secret"),(0,r.kt)("p",null,"You can use the command ",(0,r.kt)("inlineCode",{parentName:"p"},"yarn mila secrets add")," to add a secret."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},"> yarn mila secrets add\nPlease select the secret scope\n[X] global\n[ ] service-specific\n Please select the environment\n[X] all environments\n[ ] a specific environment\nSelect a key for the secret in process.env\nMY_SUPER_SECRET\nEnter a name for your secret\nmy-awesome-app/shared/super-secret\nEnter a value for your secret\n*********\n")),(0,r.kt)("p",null,"The secret is created and replicated in all regions were the target lambdas are deployed."),(0,r.kt)("p",null,"The special value is injected in the correct dotenv"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},"MY_SUPER_SECRET=${secrets:my-awesome-app/shared/super-secret}\n")),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"You can do this process manually, by creating the secret with the AWS CLI or in AWS Console. In this case, do not forget\nto replicate the secret in all AWS regions it is consumed")),(0,r.kt)("h4",{id:"update-secret-value"},"Update secret value"),(0,r.kt)("p",null,"You can use the command ",(0,r.kt)("inlineCode",{parentName:"p"},"yarn mila secrets update MY_SUPER_SECRET")," to update the secret value."),(0,r.kt)("p",null,"You may need to specify the scope of the secret using ",(0,r.kt)("inlineCode",{parentName:"p"},"-e")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"-s")," flags."),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"yarn mila secrets update -e dev -s awesome-service MY_API_SECRET_KEY"),"."),(0,r.kt)("p",null,"With this command, the value will be updated in AWS Secrets Manager in all required regions."),(0,r.kt)("h4",{id:"delete-secret"},"Delete secret"),(0,r.kt)("p",null,"You can use the command ",(0,r.kt)("inlineCode",{parentName:"p"},"yarn mila secrets delete MY_SUPER_SECRET")," to delete secret."),(0,r.kt)("p",null,"You may need to specify the scope of the secret using ",(0,r.kt)("inlineCode",{parentName:"p"},"-e")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"-s")," flags."),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"yarn mila secrets delete -e dev -s awesome-service MY_API_SECRET_KEY"),"."),(0,r.kt)("p",null,"With this command, the value will be deleted in AWS Secrets Manager in all required regions and removed from the correct\ndotenv file."),(0,r.kt)("h4",{id:"pros-and-cons"},"Pros and cons"),(0,r.kt)("p",null,"Pros:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"A secret can be created for many services/stages at the same time."),(0,r.kt)("li",{parentName:"ul"},"Secret single source of truth is respected"),(0,r.kt)("li",{parentName:"ul"},"When removing an environment, a service or a regional replicate, microlambda will destroy all related secrets.")),(0,r.kt)("p",null,"Cons:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"This must be done manually by the project leader or someone who have access to secret values.")),(0,r.kt)("h3",{id:"faq"},"FAQ"),(0,r.kt)("h4",{id:"how-to-grant-lambda-execution-role-the-permission-to-get-secret-value-"},"How to grant Lambda execution role the permission to get secret value ?"),(0,r.kt)("p",null,"No need."),(0,r.kt)("p",null,"The permission to get secret value is granted to the Lambda via the microlambda serverless plugin when packaging or\nstarting the project."),(0,r.kt)("p",null,"So you don't have to add the permissions yourself in serverless.yml IAM roles statements."),(0,r.kt)("h4",{id:"how-is-the-secret-injected-on-runtime-"},"How is the secret injected on runtime ?"),(0,r.kt)("p",null,"In the default project middleware stack, a before middleware will replace secret ARN by secret value on the target environment variable key."),(0,r.kt)("h4",{id:"should-i-version-my-secrets-"},"Should I version my secrets ?"),(0,r.kt)("p",null,"It depends."),(0,r.kt)("p",null,"If it does (or not) not make sense that the previous value is used when you redeploy from a previous state (e.g. from a previous git commit for a rollback)."),(0,r.kt)("p",null,"For instance, if you are consuming an API and the key is rotated, you want the key to be rotated also in previous version. In this case do not version."),(0,r.kt)("p",null,"In another scenario where you are using API v1 with a secret key and change to API v2 with another secret key, you might want to version the secret, or simply use a different environment variable name."))}d.isMDXComponent=!0}}]);