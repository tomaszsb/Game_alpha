# Code Style Guide - Game Alpha

**Last Updated:** December 9, 2025
**Status:** Production Standards

---

## Table of Contents

1. [TypeScript Standards](#typescript-standards)
2. [Component Patterns](#component-patterns)
3. [Service Patterns](#service-patterns)
4. [CSS & Styling](#css--styling)
5. [Testing Standards](#testing-standards)

---

## TypeScript Standards

### Strict Mode Compliance

**All code must comply with TypeScript strict mode:**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### Type Definitions

**✅ ALWAYS:** Define explicit types
```typescript
// Good
interface PlayerProps {
  playerId: string;
  gameServices: IServiceContainer;
}

function updatePlayer(player: Player, updates: Partial<Player>): Player {
  return { ...player, ...updates };
}
```

**❌ NEVER:** Use `any` type
```typescript
// Bad
function doSomething(data: any) { }  // ❌ NO!
```

### File Organization

```typescript
// 1. Imports
import React from 'react';
import { Player, GameState } from '../types/StateTypes';

// 2. Type/Interface definitions
interface ComponentProps {
  // ...
}

// 3. Component/Class definition
export function Component({ props }: ComponentProps) {
  // ...
}

// 4. Helper functions (if needed)
function helperFunction() {
  // ...
}
```

---

## Component Patterns

### Dependency Injection

**✅ CORRECT:** Props-based injection
```typescript
interface CardPortfolioProps {
  gameServices: IServiceContainer;  // Inject services
  playerId: string;
}

function CardPortfolio({ gameServices, playerId }: CardPortfolioProps) {
  const { cardService, stateService } = gameServices;
  // Use services
}
```

**❌ WRONG:** Global access
```typescript
// DON'T DO THIS
const services = window.gameServices;  // ❌
```

### State Management

**Use hooks for local state:**
```typescript
function MyComponent() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Render
}
```

**Use services for game state:**
```typescript
function MyComponent({ gameServices, playerId }: Props) {
  const { stateService } = gameServices;
  const player = stateService.getPlayer(playerId);

  // Don't store player in useState - read from service
}
```

### Event Handlers

**Async error handling:**
```typescript
const handlePlayCard = async (cardId: string) => {
  try {
    const result = await cardService.playCard(playerId, cardId);
    // Handle success
  } catch (error) {
    console.error('Failed to play card:', error);
    // Show user-friendly error message
  }
};
```

### Component Size

- **Target:** <400 lines
- **Maximum:** 1,000 lines
- **If larger:** Break into smaller components

---

## Service Patterns

### Constructor Injection

```typescript
class CardService implements ICardService {
  constructor(
    private dataService: DataService,
    private stateService: StateService,
    private effectEngineService: EffectEngineService
  ) {}

  async playCard(playerId: string, cardId: string): Promise<CardPlayResult> {
    // Use injected dependencies
    const card = this.dataService.getCardById(cardId);
    // ...
  }
}
```

### Immutable Updates

**✅ ALWAYS return new objects:**
```typescript
updatePlayer(updates: Partial<Player> & { id: string }): void {
  const current = this.getPlayer(updates.id);
  const updated = { ...current, ...updates };  // New object
  this.setState({ ...state, players: [...] });
}
```

**❌ NEVER mutate:**
```typescript
// BAD
player.money += 100;  // ❌ Direct mutation
state.players[0] = updatedPlayer;  // ❌ Array mutation
```

### Error Handling

```typescript
async performAction(): Promise<Result> {
  try {
    // Business logic
    const result = await this.doSomething();
    this.loggingService.info('Action succeeded');
    return { success: true, data: result };
  } catch (error) {
    this.loggingService.error('Action failed', { error });
    throw error;  // Re-throw for component handling
  }
}
```

---

## CSS & Styling

### CSS Variables

**Use theme variables:**
```css
:root {
  --primary-color: #2563eb;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
}

.button {
  background: var(--primary-color);
  padding: var(--spacing-md);
}
```

### Component-Scoped Styles

**CSS Modules pattern:**
```css
/* PlayerPanel.css */
.player-panel {
  display: flex;
  flex-direction: column;
}

.player-panel .section {
  margin-bottom: var(--spacing-md);
}
```

### Responsive Design

**Mobile-first approach:**
```css
/* Mobile (default) */
.container {
  width: 100%;
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    max-width: 720px;
    padding: 1.5rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 960px;
    padding: 2rem;
  }
}
```

### Accessibility

**WCAG 2.1 AA compliance:**
```css
/* Color contrast ratios */
.text-primary {
  color: #1f2937;  /* 4.5:1 minimum for normal text */
}

.text-secondary {
  color: #6b7280;  /* 4.5:1 minimum */
}

/* Focus indicators */
button:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
```

---

## Testing Standards

### Test Organization

```typescript
describe('ComponentName', () => {
  // Setup
  let mockServices: IServiceContainer;

  beforeEach(() => {
    mockServices = createMockServices();
  });

  // Tests
  it('should render correctly', () => {
    // Arrange
    const { getByText } = render(<Component {...props} />);

    // Act & Assert
    expect(getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user action', async () => {
    // Test async actions
  });
});
```

### Coverage Requirements

- **Services:** 90%+ coverage target
- **Components:** Test key behaviors
- **Integration:** Critical user flows
- **E2E:** Happy path scenarios

### Mocking Patterns

**Service mocks:**
```typescript
const mockCardService = {
  playCard: vi.fn().mockResolvedValue({ success: true }),
  drawCards: vi.fn(),
  transferCard: vi.fn()
} as unknown as ICardService;
```

**Component mocks:**
```typescript
vi.mock('./ChildComponent', () => ({
  ChildComponent: () => <div data-testid="child">Mocked</div>
}));
```

---

## File Size Limits

| File Type | Target | Maximum | Action if Exceeded |
|-----------|--------|---------|-------------------|
| **Components** | <400 lines | 1,000 lines | Split into smaller components |
| **Services** | <200 lines | 300 lines | Extract to separate services |
| **Utilities** | <100 lines | 150 lines | Split into multiple files |
| **Tests** | No limit | - | Organize with describe blocks |

---

## Code Review Checklist

Before committing code, verify:

- [ ] TypeScript strict mode compliance (no errors)
- [ ] No `any` types used
- [ ] All dependencies injected (no `window.*`)
- [ ] Immutable state updates only
- [ ] Error handling in place
- [ ] Tests written and passing
- [ ] File size limits respected
- [ ] CSS follows conventions
- [ ] Accessible (ARIA, semantic HTML)
- [ ] Mobile-responsive

---

## Additional Resources

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architectural patterns
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API documentation
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Testing strategies
- **UI Style Guide:** See `docs/architecture/UI_STYLE_GUIDE.md` (legacy - being consolidated)
- **UI Standardization:** See `docs/architecture/UI_STANDARDIZATION_ACTION_PLAN.md` (legacy)

---

**Last Updated:** December 9, 2025
**Maintained By:** Claude (AI Lead Programmer)
