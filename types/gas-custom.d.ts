declare namespace GoogleAppsScript {
    namespace Base {
        interface Logger {
            log(message: any, ...args: any[]): void;
            clear(): void;
            getLog(): string;
        }
        interface Menu {
            addItem(caption: string, functionName: string): Menu;
            addSeparator(): Menu;
            addSubMenu(menu: Menu): Menu;
            addToUi(): void;
        }
        interface Ui {
            createMenu(caption: string): Menu;
            alert(prompt: string): void;
            alert(title: string, prompt: string, buttons: any): any;
            prompt(prompt: string, buttons: any): any;
            showModalDialog(userInterface: any, title: string): void;
            showSidebar(userInterface: any): void;
        }
        interface Session {
            getActiveUser(): User;
            getEffectiveUser(): User;
            getUserProperties(): Properties;
            getScriptProperties(): Properties;
        }
        interface User {
            getEmail(): string;
            getLoginId(): string;
            getNickname(): string;
            getUserLoginId(): string;
        }
        interface Properties {
            getProperty(key: string): string | null;
            setProperty(key: string, value: string): Properties;
            deleteProperty(key: string): Properties;
            getProperties(): { [key: string]: string };
            deleteAllProperties(): Properties;
            getKeys(): string[];
        }
        interface Lock {
            tryLock(timeoutInMillis: number): boolean;
            releaseLock(): void;
            waitLock(timeoutInMillis: number): void;
            hasLock(): boolean;
        }
        interface Cache {
            get(key: string): string | null;
            put(key: string, value: string, expirationInSeconds?: number): void;
            remove(key: string): void;
            getAll(keys: string[]): { [key: string]: string };
            putAll(values: { [key: string]: string }, expirationInSeconds?: number): void;
            removeAll(keys: string[]): void;
        }
    }
    namespace Spreadsheet {
        interface SpreadsheetApp {
            getActiveSpreadsheet(): Spreadsheet;
            getUi(): Base.Ui;
            openById(id: string): Spreadsheet;
            newConditionalFormatRule(): ConditionalFormatRuleBuilder;
            flush(): void;
        }
        interface Spreadsheet {
            getId(): string;
            getName(): string;
            getSheetByName(name: string): Sheet | null;
            getSheets(): Sheet[];
            toast(message: string): void;
        }
        interface Sheet {
            getDataRange(): Range;
            getLastRow(): number;
            getLastColumn(): number;
            getRange(row: number, column: number, numRows?: number, numColumns?: number): Range;
            getRange(a1Notation: string): Range;
            appendRow(rowContents: any[]): Sheet;
            setConditionalFormatRules(rules: ConditionalFormatRule[]): void;
        }
        interface Range {
            getValues(): any[][];
            getValue(): any;
            setValue(value: any): Range;
        }
        interface ConditionalFormatRuleBuilder {
            whenNumberBetween(start: number, end: number): ConditionalFormatRuleBuilder;
            setBackground(color: string): ConditionalFormatRuleBuilder;
            build(): ConditionalFormatRule;
        }
        interface ConditionalFormatRule {}
    }
    namespace HTML {
        interface HtmlService {
            createHtmlOutputFromFile(filename: string): HtmlOutput;
            createTemplateFromFile(filename: string): HtmlTemplate;
            createHtmlOutput(html: string): HtmlOutput;
        }
        interface HtmlOutput {
            setTitle(title: string): HtmlOutput;
            setXFrameOptionsMode(mode: any): HtmlOutput;
            addMetaTag(name: string, content: string): HtmlOutput;
            getContent(): string;
        }
        interface HtmlTemplate {
            [key: string]: any;
            evaluate(): HtmlOutput;
        }
    }
    namespace Properties {
        interface PropertiesService {
            getUserProperties(): Base.Properties;
            getScriptProperties(): Base.Properties;
            getDocumentProperties(): Base.Properties;
        }
    }
    namespace Lock {
        interface LockService {
            getScriptLock(): Base.Lock;
            getUserLock(): Base.Lock;
            getDocumentLock(): Base.Lock;
        }
    }
    namespace Script {
        interface ScriptApp {
            getProjectTriggers(): Trigger[];
            newTrigger(functionName: string): TriggerBuilder;
            deleteTrigger(trigger: Trigger): void;
        }
        interface Trigger {
            getHandlerFunction(): string;
        }
        interface TriggerBuilder {
            timeBased(): any;
        }
    }
    namespace Mail {
        interface MailApp {
            sendEmail(recipient: string, subject: string, body: string, options?: any): void;
            sendEmail(message: any): void;
        }
    }
    namespace Gmail {
        interface GmailApp {
            sendEmail(recipient: string, subject: string, body: string, options?: any): void;
        }
    }
    namespace Utilities {
        interface Utilities {
            formatDate(date: Date, timeZone: string, format: string): string;
            getUuid(): string;
            sleep(milliseconds: number): void;
        }
    }
    namespace Cache {
        interface CacheService {
            getScriptCache(): Base.Cache;
            getUserCache(): Base.Cache;
            getDocumentCache(): Base.Cache;
        }
    }
    namespace Drive {
        interface DriveApp {
            getFileById(id: string): File;
        }
        interface File {
            getId(): string;
            makeCopy(destination: Folder): File;
            makeCopy(name: string): File;
        }
        interface Folder {}
    }
}

declare var SpreadsheetApp: GoogleAppsScript.Spreadsheet.SpreadsheetApp;
declare var Logger: GoogleAppsScript.Base.Logger;
declare var HtmlService: GoogleAppsScript.HTML.HtmlService;
declare var PropertiesService: GoogleAppsScript.Properties.PropertiesService;
declare var LockService: GoogleAppsScript.Lock.LockService;
declare var ScriptApp: GoogleAppsScript.Script.ScriptApp;
declare var MailApp: GoogleAppsScript.Mail.MailApp;
declare var GmailApp: GoogleAppsScript.Gmail.GmailApp;
declare var Session: GoogleAppsScript.Base.Session;
declare var Utilities: GoogleAppsScript.Utilities.Utilities;
declare var CacheService: GoogleAppsScript.Cache.CacheService;
declare var DriveApp: GoogleAppsScript.Drive.DriveApp;

export {};
