#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const program = new Command();
const CONFIG_FILE_NAME = 'a11y-config.json';

// רשימת האפשרויות המותרות (לצורך בדיקת אמיתות)
const FRAMEWORKS = ['react', 'vue', 'angular', 'html'];
const STANDARDS = ['israel', 'wcag-aa', 'wcag-aaa'];

program
  .name('a11y-guard')
  .description('CLI tool for checking accessibility and Israeli standards')
  .version('1.1.0');

program
  .command('init')
  .action(async () => {
    console.log(chalk.blue.bold('\n🛡️  A11y-Guard CLI Setup'));

    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
    
    if (fs.existsSync(configPath)) {
      const { overwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: 'Overwrite existing config?',
          default: false
      }]);
      if (!overwrite) return;
    }

    // השתמשנו ב-rawlist כדי להבטיח תמיכה מלאה ב-VS Code Terminal
    const answers = await inquirer.prompt([
      {
        type: 'rawlist', // שינוי ל-rawlist (בחירה לפי מספרים)
        name: 'framework',
        message: 'Select your project framework (type the number):',
        choices: [
            { name: 'React (JSX/TSX)', value: 'react' },
            { name: 'Vue.js', value: 'vue' },
            { name: 'Angular', value: 'angular' },
            { name: 'Vanilla HTML/JS', value: 'html' }
        ]
      },
      {
        type: 'rawlist',
        name: 'standard',
        message: 'Select accessibility standard:',
        choices: [
            { name: 'Israeli Standard (IS 5568)', value: 'israel' },
            { name: 'Global (WCAG 2.1 AA)', value: 'wcag-aa' },
            { name: 'Strict (WCAG 2.1 AAA)', value: 'wcag-aaa' }
        ]
      },
      {
        type: 'confirm',
        name: 'checkContrast',
        message: 'Check Color Contrast?',
        default: true
      },
      {
        type: 'confirm',
        name: 'useAI',
        message: 'Enable AI suggestions?',
        default: true
      }
    ]);

    // --- בדיקת אמיתות התשובות (Validation) ---
    // אם המשתמש הצליח להכניס ערך לא חוקי (כמו "d")
    if (!FRAMEWORKS.includes(answers.framework) || !STANDARDS.includes(answers.standard)) {
        console.log(chalk.red.bold('\n❌ Error: Invalid selection detected!'));
        console.log(chalk.red('Please select an option from the list using the numbers provided.'));
        return; // עוצר את השמירה
    }

    const config = {
        framework: answers.framework,
        standard: answers.standard,
        rules: {
            checkContrast: answers.checkContrast,
            rtl: answers.standard === 'israel',
            level: answers.standard === 'wcag-aaa' ? 'AAA' : 'AA'
        },
        ai: { enabled: answers.useAI }
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green.bold('\n✅ Configuration saved!'));
      console.log(chalk.cyan(`Framework: ${config.framework}, Standard: ${config.standard}`));
    } catch (e) {
      console.error(chalk.red('Failed to save config'), e);
    }
  });

program.parse(process.argv);