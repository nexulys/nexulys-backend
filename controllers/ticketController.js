const Ticket = require('../models/Ticket');
const { notifyTicketOpened } = require('../utils/notifications');
const { sendError } = require('../utils/errorResponse');

exports.getTickets = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.statut) filter.statut = req.query.statut;
    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) { sendError(res, err); }
};

exports.createTicket = async (req, res) => {
  try {
    const user = req.user;
    let rapporteurNom = 'Équipe';
    if (user.prenom && user.nom) {
      rapporteurNom = `${user.prenom} ${user.nom}`;
    } else if (user.prenom) {
      rapporteurNom = user.prenom;
    } else if (user.nom) {
      rapporteurNom = user.nom;
    }
    const ticket = await Ticket.create({
      ...req.body,
      company: req.user.company,
      createdBy: req.user.id,
      rapporteurNom
    });
    notifyTicketOpened(req.user.company, { titre: ticket.titre, priorite: ticket.priorite, rapporteurNom: ticket.rapporteurNom });
    res.status(201).json({ success: true, data: ticket });
  } catch (err) { sendError(res, err); }
};

exports.updateTicketStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const update = { statut };
    if (statut === 'resolu') update.resolvedAt = new Date();
    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    res.json({ success: true, data: ticket });
  } catch (err) { sendError(res, err); }
};

exports.deleteTicket = async (req, res) => {
  try {
    await Ticket.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Ticket supprimé' });
  } catch (err) { sendError(res, err); }
};
