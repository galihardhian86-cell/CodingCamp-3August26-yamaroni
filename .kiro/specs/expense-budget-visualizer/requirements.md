# Requirements Document

## Introduction

The Expense and Budget Visualizer is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It allows users to track personal expenses by entering transactions with a name, amount, and category. The app displays a running total balance, a scrollable transaction list with delete capability, and a live pie chart showing spending distribution by category. All data is persisted in the browser's Local Storage, requiring no backend server or account setup.

## Glossary

- **App**: The Expense and Budget Visualizer web application running in the user's browser.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: A classification label for a transaction; one of: Food, Transport, or Fun.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Balance_Display**: The UI component at the top of the page that shows the current total of all transaction amounts.
- **Input_Form**: The HTML form containing the Item Name, Amount, and Category fields used to add a new transaction.
- **Chart**: The pie chart rendered using Chart.js that visualises spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data between sessions.
- **Validator**: The client-side logic that checks Input_Form fields before a transaction is saved.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category, so that I can record a new expense.

#### Acceptance Criteria

1. THE Input_Form SHALL contain three fields: Item Name (text, max 100 characters), Amount (numeric, range 0.01 to 999,999,999.99), and Category (select with options Food, Transport, Fun).
2. WHEN the user submits the Input_Form with all fields filled and the Amount between 0.01 and 999,999,999.99 inclusive, THE App SHALL add a new Transaction to the Transaction_List and persist it to Storage within 2 seconds.
3. WHEN the user submits the Input_Form, THE Validator SHALL verify that the Item Name field is not empty (after trimming whitespace), the Amount field contains a numeric value between 0.01 and 999,999,999.99, and the Category field has a selected value.
4. IF the Validator detects that the Item Name field is empty or contains only whitespace, THEN THE Input_Form SHALL display an inline error message adjacent to the Item Name field and SHALL NOT add the Transaction.
5. IF the Validator detects that the Amount field is empty, non-numeric, zero, negative, or exceeds 999,999,999.99, THEN THE Input_Form SHALL display an inline error message adjacent to the Amount field and SHALL NOT add the Transaction.
6. IF the Validator detects that no Category has been selected, THEN THE Input_Form SHALL display an inline error message adjacent to the Category field and SHALL NOT add the Transaction.
7. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the Item Name field to empty, the Amount field to empty, and the Category field to its unselected placeholder state.

---

### Requirement 2: View and Delete Transactions

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list and remove any entry, so that I can manage my expense history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted Transactions, each showing the item name (truncated at 50 characters with an ellipsis if longer), the amount formatted as a currency symbol followed by two decimal places, and the category label.
2. WHILE the number of Transactions exceeds the visible area of the Transaction_List container, THE Transaction_List SHALL be vertically scrollable without affecting the rest of the page layout.
3. THE Transaction_List SHALL render Transactions in the order they were added, with the most recent entry at the top.
4. WHEN the user activates the delete control on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Storage, and the UI SHALL reflect the removal without requiring a page reload.
5. IF a delete operation fails to update Storage, THEN THE App SHALL display an error message to the user and SHALL restore the Transaction to the Transaction_List in its original position.
6. WHEN the Transaction_List contains no Transactions, THE Transaction_List SHALL display an empty-state message indicating no expenses have been recorded.

---

### Requirement 3: Display Total Balance

**User Story:** As a user, I want to see the current total of all my expenses at the top of the page, so that I can monitor my overall spending at a glance.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted as a currency symbol followed by a non-negative numeric value with exactly two decimal places.
2. WHEN a Transaction is added, THE Balance_Display SHALL update to reflect the new total within 100ms without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100ms without requiring a page reload.
4. WHILE the Transaction_List contains no Transactions, THE Balance_Display SHALL show a value of 0.00.
5. WHEN the sum of Transaction amounts produces a value with more than two decimal places, THE Balance_Display SHALL round the displayed value to two decimal places using the round-half-up rule.

---

### Requirement 4: Visualise Spending by Category

**User Story:** As a user, I want to see a pie chart breaking down my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart that shows one slice per Category that has at least one Transaction, with each slice sized proportionally to that Category's total Transaction amount divided by the sum of all Transaction amounts.
2. WHEN a Transaction is added, THE Chart SHALL update to reflect the new category distribution within 100ms without requiring a page reload.
3. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the revised category distribution within 100ms without requiring a page reload.
4. THE Chart SHALL label each slice with the Category name and its percentage of total spending, calculated as (Category total / sum of all Transaction amounts) × 100, rounded to one decimal place.
5. WHILE the Transaction_List contains no Transactions, THE Chart SHALL display a placeholder state with no pie slices rendered.
6. WHEN a Transaction's Category or amount is changed, THE Chart SHALL update to reflect the new category distribution within 100ms.
7. WHEN two or more Categories share the same rounded percentage value, THE Chart SHALL display each slice with its independently calculated percentage without merging or combining slices.

---

### Requirement 5: Persist Data Across Sessions

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I don't lose my expense history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE Storage SHALL serialise and save the complete Transaction_List to Local Storage under a fixed key within 500ms.
2. WHEN a Transaction is deleted, THE Storage SHALL serialise and save the updated Transaction_List to Local Storage within 500ms.
3. WHEN the App initialises, THE App SHALL read the Transaction_List from Local Storage and restore all previously saved Transactions to the Transaction_List, Balance_Display, and Chart within 1000ms.
4. IF Local Storage is unavailable or the stored data cannot be parsed, THEN THE App SHALL initialise with an empty Transaction_List and SHALL display an informational message identifying that saved data could not be loaded.
5. WHEN the App restores Transactions from Local Storage, each restored Transaction SHALL preserve its original item name, amount, category, and insertion order without modification.

---

### Requirement 6: Responsive and Accessible UI

**User Story:** As a user, I want the app to be readable and usable on different screen sizes and with keyboard navigation, so that I can use it comfortably on any device.

#### Acceptance Criteria

1. THE App SHALL be usable on viewport widths from 320px to 1920px without horizontal scrolling or content overflow.
2. THE Input_Form fields and submit button SHALL be navigable and operable using the keyboard Tab and Enter keys, with a visible focus indicator displayed on each focused element.
3. IF a user completes the Input_Form fields and activates the submit button using only keyboard input (Tab, Enter, and arrow keys), THEN THE App SHALL add the Transaction without requiring mouse interaction.
4. THE App SHALL load and render fully within 2 seconds, measured from the initial page request to full content visibility, on a standard broadband connection (≥ 10 Mbps).
5. THE App SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari.
6. WHEN the viewport width is less than 768px, THE App SHALL stack all UI sections vertically and no individual element SHALL exceed the viewport width.
