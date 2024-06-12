import { QuestionCollection } from 'inquirer';

const questions: QuestionCollection = [
  {
    type: "input",
    name: "name",
    message: "Your service name",
    validate: (input: string) => {
      if (input.match(/^[0-9A-Za-z-]+$/) == null) {
        return 'service name must follow pattern ^[0-9A-Za-z-]+$';
      }
      return true;
    },
  },
  {
    type: "input",
    name: "description",
    message: "Describe briefly your service",
  },
];

export default questions;
