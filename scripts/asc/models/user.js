class User {
    constructor(data) {
        this.data = data;
    }

    static create(data) {
        return new User(data);
    }
    
    getUsername() {
        return this.data.email;
    }

    getEmail() {
        return this.data.email;
    }

    getDisplayName() {
        return this.data.displayName;
    }
}

export default User;    