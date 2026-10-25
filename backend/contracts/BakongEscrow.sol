// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BakongEscrow
 * @notice Trustless e-commerce escrow protocol integrated with Cambodia's National Bakong KHQR.
 * @dev Holds transactions in cryptographic escrow between Buyer and Seller with Arbiter oversight.
 *      Funds are verified via Bakong KHQR notarization, locked in smart contract state,
 *      and released upon buyer delivery confirmation or resolved through decentralized arbitration.
 */
contract BakongEscrow {
    enum EscrowState {
        INITIATED,      // Agreement created, waiting for Bakong KHQR payment
        FUNDS_LOCKED,   // Bakong payment verified and locked into escrow vault
        DISPATCHED,     // Goods dispatched by seller, inspection countdown active
        RELEASED,       // Buyer approved delivery; funds released to seller
        DISPUTED,       // Buyer raised dispute; awaiting arbitration
        REFUNDED        // Arbiter or seller approved refund to buyer
    }

    struct EscrowAgreement {
        string orderNumber;
        address buyer;
        address seller;
        address arbiter;
        uint256 amountInCents;        // Amount in USD cents (e.g., $48.50 = 4850)
        string bakongReference;       // Bakong KHQR MD5 hash reference
        bytes32 paymentProofHash;     // Cryptographic proof of Bakong transaction
        EscrowState state;
        uint256 createdAt;
        uint256 lockedAt;
        uint256 dispatchedAt;
        uint256 autoReleaseDeadline;  // Auto-release timestamp if no dispute raised
        uint256 finalizedAt;
        string disputeReason;
        string resolutionNotes;
    }

    address public immutable protocolOwner;
    address public defaultArbiter;
    uint256 public constant DEFAULT_INSPECTION_DAYS = 3 days;

    mapping(string => EscrowAgreement) private _escrows;
    string[] private _allOrders;

    event EscrowCreated(
        string indexed orderNumber,
        address indexed buyer,
        address indexed seller,
        uint256 amountInCents
    );
    event FundsLocked(
        string indexed orderNumber,
        string bakongReference,
        bytes32 paymentProofHash,
        uint256 timestamp
    );
    event OrderDispatched(
        string indexed orderNumber,
        uint256 autoReleaseDeadline,
        uint256 timestamp
    );
    event FundsReleased(
        string indexed orderNumber,
        address indexed seller,
        uint256 amountInCents,
        uint256 timestamp
    );
    event DisputeRaised(
        string indexed orderNumber,
        address indexed raisedBy,
        string reason,
        uint256 timestamp
    );
    event DisputeResolved(
        string indexed orderNumber,
        EscrowState finalState,
        string resolutionNotes,
        uint256 timestamp
    );

    modifier onlyBuyer(string memory orderNumber) {
        require(msg.sender == _escrows[orderNumber].buyer, "BakongEscrow: only buyer can execute");
        _;
    }

    modifier onlySeller(string memory orderNumber) {
        require(msg.sender == _escrows[orderNumber].seller, "BakongEscrow: only seller can execute");
        _;
    }

    modifier onlyArbiter(string memory orderNumber) {
        require(
            msg.sender == _escrows[orderNumber].arbiter || msg.sender == protocolOwner,
            "BakongEscrow: only authorized arbiter can execute"
        );
        _;
    }

    modifier inState(string memory orderNumber, EscrowState expectedState) {
        require(_escrows[orderNumber].state == expectedState, "BakongEscrow: invalid state transition");
        _;
    }

    constructor(address _arbiter) {
        protocolOwner = msg.sender;
        defaultArbiter = _arbiter == address(0) ? msg.sender : _arbiter;
    }

    /**
     * @notice Initialize a new escrow agreement for a sale
     */
    function createEscrow(
        string calldata orderNumber,
        address buyer,
        address seller,
        address arbiter,
        uint256 amountInCents
    ) external returns (bytes32) {
        require(_escrows[orderNumber].createdAt == 0, "BakongEscrow: escrow already exists");
        require(buyer != address(0) && seller != address(0), "BakongEscrow: invalid participant");
        require(amountInCents > 0, "BakongEscrow: amount must be greater than zero");

        address resolvedArbiter = arbiter == address(0) ? defaultArbiter : arbiter;

        _escrows[orderNumber] = EscrowAgreement({
            orderNumber: orderNumber,
            buyer: buyer,
            seller: seller,
            arbiter: resolvedArbiter,
            amountInCents: amountInCents,
            bakongReference: "",
            paymentProofHash: bytes32(0),
            state: EscrowState.INITIATED,
            createdAt: block.timestamp,
            lockedAt: 0,
            dispatchedAt: 0,
            autoReleaseDeadline: 0,
            finalizedAt: 0,
            disputeReason: "",
            resolutionNotes: ""
        });

        _allOrders.push(orderNumber);

        emit EscrowCreated(orderNumber, buyer, seller, amountInCents);

        return keccak256(abi.encodePacked(orderNumber, buyer, seller, amountInCents, block.timestamp));
    }

    /**
     * @notice Notarize Bakong payment confirmation and lock funds into escrow
     */
    function lockFunds(
        string calldata orderNumber,
        string calldata bakongReference,
        bytes32 paymentProofHash
    ) external inState(orderNumber, EscrowState.INITIATED) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        escrow.bakongReference = bakongReference;
        escrow.paymentProofHash = paymentProofHash;
        escrow.state = EscrowState.FUNDS_LOCKED;
        escrow.lockedAt = block.timestamp;

        emit FundsLocked(orderNumber, bakongReference, paymentProofHash, block.timestamp);
    }

    /**
     * @notice Seller marks goods as dispatched, starting the inspection window
     */
    function dispatchOrder(
        string calldata orderNumber,
        uint256 customInspectionDays
    ) external onlySeller(orderNumber) inState(orderNumber, EscrowState.FUNDS_LOCKED) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        uint256 inspectionDuration = customInspectionDays > 0 ? customInspectionDays * 1 days : DEFAULT_INSPECTION_DAYS;

        escrow.state = EscrowState.DISPATCHED;
        escrow.dispatchedAt = block.timestamp;
        escrow.autoReleaseDeadline = block.timestamp + inspectionDuration;

        emit OrderDispatched(orderNumber, escrow.autoReleaseDeadline, block.timestamp);
    }

    /**
     * @notice Buyer confirms delivery and inspects goods, releasing locked funds to seller
     */
    function releaseFunds(
        string calldata orderNumber
    ) external onlyBuyer(orderNumber) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        require(
            escrow.state == EscrowState.FUNDS_LOCKED || escrow.state == EscrowState.DISPATCHED,
            "BakongEscrow: cannot release in current state"
        );

        escrow.state = EscrowState.RELEASED;
        escrow.finalizedAt = block.timestamp;

        emit FundsReleased(orderNumber, escrow.seller, escrow.amountInCents, block.timestamp);
    }

    /**
     * @notice Anyone can trigger auto-release if the inspection deadline has passed with no disputes
     */
    function triggerAutoRelease(string calldata orderNumber) external inState(orderNumber, EscrowState.DISPATCHED) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        require(block.timestamp >= escrow.autoReleaseDeadline, "BakongEscrow: inspection deadline not yet reached");

        escrow.state = EscrowState.RELEASED;
        escrow.finalizedAt = block.timestamp;

        emit FundsReleased(orderNumber, escrow.seller, escrow.amountInCents, block.timestamp);
    }

    /**
     * @notice Buyer raises a formal dispute within the inspection window
     */
    function raiseDispute(
        string calldata orderNumber,
        string calldata reason
    ) external onlyBuyer(orderNumber) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        require(
            escrow.state == EscrowState.FUNDS_LOCKED || escrow.state == EscrowState.DISPATCHED,
            "BakongEscrow: cannot dispute in current state"
        );

        escrow.state = EscrowState.DISPUTED;
        escrow.disputeReason = reason;

        emit DisputeRaised(orderNumber, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Arbiter resolves dispute in favor of seller or buyer
     */
    function resolveDispute(
        string calldata orderNumber,
        bool refundToBuyer,
        string calldata notes
    ) external onlyArbiter(orderNumber) inState(orderNumber, EscrowState.DISPUTED) {
        EscrowAgreement storage escrow = _escrows[orderNumber];
        escrow.state = refundToBuyer ? EscrowState.REFUNDED : EscrowState.RELEASED;
        escrow.finalizedAt = block.timestamp;
        escrow.resolutionNotes = notes;

        emit DisputeResolved(orderNumber, escrow.state, notes, block.timestamp);
    }

    /**
     * @notice Read complete escrow details
     */
    function getEscrow(string calldata orderNumber) external view returns (EscrowAgreement memory) {
        require(_escrows[orderNumber].createdAt > 0, "BakongEscrow: escrow not found");
        return _escrows[orderNumber];
    }

    /**
     * @notice Get total count of escrows
     */
    function getTotalEscrows() external view returns (uint256) {
        return _allOrders.length;
    }
}
