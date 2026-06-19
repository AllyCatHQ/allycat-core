/**
 * RegionFalsePositive.jsx
 *
 * TEST PURPOSE: Regression test — "region" rule must NOT fire on components.
 * Components are fragments that live inside landmarks at runtime.
 * Expected result: allycat should report 0 issues.
 */

function UserCard({ user }) {
    return (
        <div className="user-card">
            <img src={user.avatar} alt={`${user.name}'s avatar`} />
            <h3>{user.name}</h3>
            <p>{user.bio}</p>
            <button type="button">Follow</button>
        </div>
    );
}

function SearchBar() {
    return (
        <form role="search" aria-label="Site search">
            <label htmlFor="search-input">Search</label>
            <input id="search-input" type="search" name="q" />
            <button type="submit">Go</button>
        </form>
    );
}

function NotificationBanner({ message }) {
    return (
        <div role="alert" aria-live="polite">
            <p>{message}</p>
            <button type="button" aria-label="Dismiss notification">×</button>
        </div>
    );
}

export { UserCard, SearchBar, NotificationBanner };
